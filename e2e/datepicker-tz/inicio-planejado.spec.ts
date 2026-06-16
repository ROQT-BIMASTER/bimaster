/**
 * E2E — Datepicker "Início planejado" com matriz de fusos horários.
 *
 * Roda em 3 projects (definidos em playwright.config.ts): tz-sao-paulo,
 * tz-utc e tz-tokyo. Cada um exercita os MESMOS cenários, garantindo que
 * o valor escolhido pelo usuário no calendário do shadcn:
 *   1. é exibido corretamente no botão imediatamente após a seleção;
 *   2. persiste após reload (round-trip UI ↔ backend);
 *   3. chega à coluna Postgres DATE exatamente como YYYY-MM-DD,
 *      verificado via PostgREST autenticado.
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
import { login, getAccessToken } from "./helpers/auth";
import { getTarefaDatas } from "./helpers/supabaseRest";

const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";
const TAREFA_ID = process.env.E2E_TAREFA_ID ?? "";

const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Datas-alvo escolhidas para cobrir os cenários clássicos de shift:
 *   - 2026-06-16: dia "neutro" no meio do ano, fora de DST e fora de borda
 *   - 2026-12-31: borda de ano descendente (shift -1 → 30-dez)
 *   - 2027-01-01: borda de ano ascendente  (shift +1 → 02-jan)
 */
const TARGETS: Array<{ label: string; iso: string; year: number; monthIndex: number; day: number; uiRegex: RegExp }> = [
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

async function abrirTarefa(page: Page) {
  await page.goto(`/dashboard/projetos/${PROJETO_ID}?tarefa=${TAREFA_ID}`);
  // Detalhe renderiza o rótulo "Início planejado" como <span> ao lado do botão.
  await expect(page.getByText(/in(í|i)cio planejado/i).first()).toBeVisible({ timeout: 30_000 });
}

async function navegarCalendarioPara(page: Page, monthIndex: number, year: number) {
  // O Calendar (react-day-picker via shadcn) tem botão "Go to previous/next month"
  // e cabeçalho com "Mes Ano" (locale ptBR via date-fns). Avança/recua até bater.
  const alvoTitulo = new RegExp(`${MESES_PT[monthIndex]}\\s+${year}`, "i");
  for (let i = 0; i < 240; i++) {
    const caption = page.locator('[role="dialog"] .rdp-caption_label, [role="dialog"] [class*="rdp-caption"]').first();
    const text = (await caption.textContent())?.trim() ?? "";
    if (alvoTitulo.test(text)) return;
    // Decide direção: tenta extrair mês/ano atual; se não conseguir, avança.
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

async function selecionarDataInicioPlanejada(page: Page, target: typeof TARGETS[number]) {
  // Botão do "Início planejado" — o componente usa o mesmo padrão do "Data prazo"
  // logo acima. Localizamos pela proximidade com o rótulo.
  const label = page.getByText(/in(í|i)cio planejado/i).first();
  const triggerBtn = label.locator("xpath=following::button[1]");
  await triggerBtn.click();
  await navegarCalendarioPara(page, target.monthIndex, target.year);
  // Em react-day-picker os dias são role=gridcell ou role=button name="<dia>"
  // Filtra o dia exato e clica no PRIMEIRO disponível do mês corrente.
  const day = page
    .getByRole("gridcell", { name: new RegExp(`^${target.day}$`) })
    .or(page.getByRole("button", { name: new RegExp(`^${target.day}$`) }))
    .first();
  await day.click();
  // Popover fecha sozinho (UX consertada). Aguarda o botão refletir o valor.
  await expect(triggerBtn).toContainText(target.uiRegex, { timeout: 5_000 });
}

test.describe("Datepicker @ Início planejado — round-trip UI + backend", () => {
  for (const target of TARGETS) {
    test(`grava ${target.label} sem shift de fuso`, async ({ page }) => {
      await login(page);
      await abrirTarefa(page);

      await selecionarDataInicioPlanejada(page, target);

      // 1. UI imediata: o botão exibe o dia clicado.
      const label = page.getByText(/in(í|i)cio planejado/i).first();
      const triggerBtn = label.locator("xpath=following::button[1]");
      await expect(triggerBtn).toContainText(target.uiRegex);

      // 2. Backend: PostgREST autenticado devolve exatamente o YYYY-MM-DD.
      const token = await getAccessToken(page);
      // Pequeno backoff para a mutação chegar (TanStack Query → supabase-js).
      let backend = await getTarefaDatas(TAREFA_ID, token);
      for (let i = 0; i < 10 && backend.data_inicio_planejada !== target.iso; i++) {
        await page.waitForTimeout(300);
        backend = await getTarefaDatas(TAREFA_ID, token);
      }
      expect(backend.data_inicio_planejada).toBe(target.iso);

      // 3. Reload: o dia persistido continua o mesmo na UI.
      await page.reload();
      await expect(page.getByText(/in(í|i)cio planejado/i).first()).toBeVisible({ timeout: 30_000 });
      const triggerAfterReload = page
        .getByText(/in(í|i)cio planejado/i)
        .first()
        .locator("xpath=following::button[1]");
      await expect(triggerAfterReload).toContainText(target.uiRegex);
    });
  }
});
