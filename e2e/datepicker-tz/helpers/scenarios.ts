/**
 * Runner compartilhado dos cenários de datepicker × matriz de fusos.
 *
 * Cada datepicker da tela de detalhe da tarefa (Início planejado, Data prazo,
 * Próxima ação) usa exatamente o mesmo padrão visual (botão + Popover +
 * shadcn Calendar) e o mesmo contrato no backend (coluna Postgres DATE
 * gravada via formatLocalDate -> "YYYY-MM-DD"). Reaproveitamos os mesmos
 * cenários — 16-jun-2026 (neutro), 31-dez-2026 (borda descendente),
 * 01-jan-2027 (borda ascendente) — para todos eles.
 *
 * Pré-requisitos (todos via env, suíte pula com motivo claro se faltar):
 *   - E2E_BASE_URL              URL do preview/staging
 *   - E2E_TEST_EMAIL/PASSWORD   credenciais do usuário membro da tarefa
 *   - E2E_SUPABASE_URL          base do backend (https://<ref>.supabase.co)
 *   - E2E_SUPABASE_ANON_KEY     anon/publishable key
 *   - E2E_PROJETO_ID            UUID do projeto-mãe
 *   - E2E_TAREFA_ID             UUID da tarefa onde o teste irá pintar a data
 */
import { test, expect, type Page } from "@playwright/test";
import { login, getAccessToken } from "./auth";
import { getTarefaDatas, type TarefaDateColumn } from "./supabaseRest";

const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";
const TAREFA_ID = process.env.E2E_TAREFA_ID ?? "";

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export interface Target {
  label: string;
  iso: string;
  year: number;
  monthIndex: number;
  day: number;
  uiRegex: RegExp;
}

export const TARGETS: Target[] = [
  {
    label: "16-jun-2026 (neutro)",
    iso: "2026-06-16",
    year: 2026,
    monthIndex: 5,
    day: 16,
    uiRegex: /16\s+jun\.?\s+2026/i,
  },
  {
    label: "31-dez-2026 (borda descendente)",
    iso: "2026-12-31",
    year: 2026,
    monthIndex: 11,
    day: 31,
    uiRegex: /31\s+dez\.?\s+2026/i,
  },
  {
    label: "01-jan-2027 (borda ascendente)",
    iso: "2027-01-01",
    year: 2027,
    monthIndex: 0,
    day: 1,
    uiRegex: /(0?1)\s+jan\.?\s+2027/i,
  },
];

export function ensureEnv() {
  test.beforeAll(() => {
    const missing: string[] = [];
    if (!process.env.E2E_BASE_URL) missing.push("E2E_BASE_URL");
    if (!process.env.E2E_TEST_EMAIL) missing.push("E2E_TEST_EMAIL");
    if (!process.env.E2E_TEST_PASSWORD) missing.push("E2E_TEST_PASSWORD");
    if (!process.env.E2E_SUPABASE_URL) missing.push("E2E_SUPABASE_URL");
    if (!process.env.E2E_SUPABASE_ANON_KEY) missing.push("E2E_SUPABASE_ANON_KEY");
    if (!PROJETO_ID) missing.push("E2E_PROJETO_ID");
    if (!TAREFA_ID) missing.push("E2E_TAREFA_ID");
    test.skip(missing.length > 0, `Variáveis ausentes: ${missing.join(", ")}`);
  });
}

async function abrirTarefa(page: Page, fieldLabelRegex: RegExp) {
  await page.goto(`/dashboard/projetos/${PROJETO_ID}?tarefa=${TAREFA_ID}`);
  await expect(page.getByText(fieldLabelRegex).first()).toBeVisible({ timeout: 30_000 });
}

async function navegarCalendarioPara(page: Page, monthIndex: number, year: number) {
  const alvoTitulo = new RegExp(`${MESES_PT[monthIndex]}\\s+${year}`, "i");
  for (let i = 0; i < 240; i++) {
    const caption = page.locator('[role="dialog"] .rdp-caption_label, [role="dialog"] [class*="rdp-caption"]').first();
    const text = (await caption.textContent())?.trim() ?? "";
    if (alvoTitulo.test(text)) return;
    const m = /(\w+)\s+(\d{4})/.exec(text);
    let goNext = true;
    if (m) {
      const curMonthIdx = MESES_PT.findIndex(x => x.toLowerCase() === m[1].toLowerCase());
      const curYear = Number(m[2]);
      const curIdx = curYear * 12 + curMonthIdx;
      const alvoIdx = year * 12 + monthIndex;
      goNext = alvoIdx > curIdx;
    }
    const btn = page.getByRole("button", {
      name: goNext ? /go to (the )?next month|próximo m(ê|e)s/i : /go to (the )?previous month|m(ê|e)s anterior/i,
    });
    await btn.first().click();
    await page.waitForTimeout(80);
  }
  throw new Error(`Não consegui navegar até ${MESES_PT[monthIndex]} ${year}`);
}

function triggerByLabel(page: Page, labelRegex: RegExp) {
  return page.getByText(labelRegex).first().locator("xpath=following::button[1]");
}

async function selecionarData(page: Page, labelRegex: RegExp, target: Target) {
  const trigger = triggerByLabel(page, labelRegex);
  await trigger.click();
  await navegarCalendarioPara(page, target.monthIndex, target.year);
  const day = page
    .getByRole("gridcell", { name: new RegExp(`^${target.day}$`) })
    .or(page.getByRole("button", { name: new RegExp(`^${target.day}$`) }))
    .first();
  await day.click();
  await expect(trigger).toContainText(target.uiRegex, { timeout: 5_000 });
}

export interface DatepickerScenarioOptions {
  /** Coluna Postgres DATE validada via PostgREST. */
  column: TarefaDateColumn;
  /** Regex usada para localizar o rótulo do campo na UI (e o botão associado). */
  fieldLabelRegex: RegExp;
  /** Nome humano do campo, usado no describe(). */
  fieldName: string;
}

/**
 * Registra a matriz de cenários (3 datas) para um datepicker específico.
 * Os 3 fusos (sao-paulo, utc, tokyo) vêm de `playwright.config.ts`.
 */
export function registerDatepickerScenarios(opts: DatepickerScenarioOptions) {
  ensureEnv();

  test.describe(`Datepicker @ ${opts.fieldName} — round-trip UI + backend`, () => {
    for (const target of TARGETS) {
      test(`grava ${target.label} sem shift de fuso`, async ({ page }) => {
        await login(page);
        await abrirTarefa(page, opts.fieldLabelRegex);

        await selecionarData(page, opts.fieldLabelRegex, target);

        // 1. UI imediata
        await expect(triggerByLabel(page, opts.fieldLabelRegex)).toContainText(target.uiRegex);

        // 2. Backend: PostgREST devolve exatamente o YYYY-MM-DD
        const token = await getAccessToken(page);
        let backend = await getTarefaDatas(TAREFA_ID, token, [opts.column]);
        for (let i = 0; i < 10 && backend[opts.column] !== target.iso; i++) {
          await page.waitForTimeout(300);
          backend = await getTarefaDatas(TAREFA_ID, token, [opts.column]);
        }
        expect(backend[opts.column]).toBe(target.iso);

        // 3. Reload: o dia persistido continua o mesmo na UI
        await page.reload();
        await expect(page.getByText(opts.fieldLabelRegex).first()).toBeVisible({ timeout: 30_000 });
        await expect(triggerByLabel(page, opts.fieldLabelRegex)).toContainText(target.uiRegex);
      });
    }
  });
}
