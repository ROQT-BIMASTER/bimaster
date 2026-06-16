/**
 * E2E — Limpeza dos datepickers pela UI.
 *
 * Para cada campo opcional (Data prazo, Próxima ação) o teste:
 *   1. Semeia uma data válida via PostgREST (estado conhecido).
 *   2. Abre a tarefa, abre o popover do campo e clica em "Limpar data".
 *   3. Valida que o botão volta ao placeholder, sem datas-fantasma UTC
 *      (1969/1970 ou meses pt-BR).
 *   4. Confirma via PostgREST que a coluna virou `null`.
 *   5. Recarrega a página e confirma UI + backend continuam null.
 *
 * Roda nos 3 fusos (SP, UTC, Tokyo) via os projects do playwright.config.ts.
 */
import { test, expect, type Page } from "@playwright/test";
import { login, getAccessToken } from "./helpers/auth";
import {
  getTarefaDatas,
  patchTarefaDatas,
  type TarefaDateColumn,
} from "./helpers/supabaseRest";

const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";
const TAREFA_ID = process.env.E2E_TAREFA_ID ?? "";

interface CampoLimpavel {
  column: TarefaDateColumn;
  fieldName: string;
  fieldLabelRegex: RegExp;
  placeholderRegex: RegExp;
  /** data-testid do botão "Limpar data" dentro do PopoverContent. */
  clearTestId: string;
  /** Data válida usada para semear antes do clique de limpeza. */
  seedIso: string;
}

const CAMPOS: CampoLimpavel[] = [
  {
    column: "data_prazo",
    fieldName: "Data prazo",
    fieldLabelRegex: /data prazo/i,
    placeholderRegex: /definir prazo/i,
    clearTestId: "clear-data-prazo",
    seedIso: "2026-12-31",
  },
  {
    column: "data_proxima_acao",
    fieldName: "Próxima ação",
    fieldLabelRegex: /pr(ó|o)xima a(ç|c)(ã|a)o/i,
    placeholderRegex: /definir pr(ó|o)xima a(ç|c)(ã|a)o/i,
    clearTestId: "clear-data-proxima-acao",
    seedIso: "2027-01-01",
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

function triggerByLabel(page: Page, labelRegex: RegExp) {
  return page.getByText(labelRegex).first().locator("xpath=following::button[1]");
}

for (const campo of CAMPOS) {
  test.describe(`Datepicker @ ${campo.fieldName} — limpar pela UI`, () => {
    test("UI e backend ficam null após clicar em Limpar", async ({ page }) => {
      await login(page);
      const token = await getAccessToken(page);

      // 1. Seed: estado conhecido com data presente.
      await patchTarefaDatas(TAREFA_ID, token, { [campo.column]: campo.seedIso });
      const seeded = await getTarefaDatas(TAREFA_ID, token, [campo.column]);
      expect(seeded[campo.column]).toBe(campo.seedIso);

      // 2. Abrir a tarefa e o popover.
      await page.goto(`/dashboard/projetos/${PROJETO_ID}?tarefa=${TAREFA_ID}`);
      const label = page.getByText(campo.fieldLabelRegex).first();
      await expect(label).toBeVisible({ timeout: 30_000 });

      const trigger = triggerByLabel(page, campo.fieldLabelRegex);
      // O botão deve mostrar a data semeada (não placeholder).
      await expect(trigger).not.toContainText(campo.placeholderRegex);
      await trigger.click();

      // 3. Clicar em "Limpar data".
      const clearBtn = page.getByTestId(campo.clearTestId);
      await expect(clearBtn).toBeVisible({ timeout: 5_000 });
      await clearBtn.click();

      // 4. UI imediata: volta para placeholder, sem datas-fantasma.
      await expect(trigger).toContainText(campo.placeholderRegex, { timeout: 5_000 });
      await expect(trigger).not.toContainText(/1969|1970/);
      await expect(trigger).not.toContainText(
        /\b\d{1,2}\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i,
      );

      // 5. Backend: PATCH propagou e a coluna é null.
      let backend = await getTarefaDatas(TAREFA_ID, token, [campo.column]);
      for (let i = 0; i < 10 && backend[campo.column] !== null; i++) {
        await page.waitForTimeout(300);
        backend = await getTarefaDatas(TAREFA_ID, token, [campo.column]);
      }
      expect(backend[campo.column]).toBeNull();

      // 6. Reload: UI + backend continuam null.
      await page.reload();
      await expect(page.getByText(campo.fieldLabelRegex).first()).toBeVisible({ timeout: 30_000 });
      await expect(triggerByLabel(page, campo.fieldLabelRegex)).toContainText(campo.placeholderRegex);
      const afterReload = await getTarefaDatas(TAREFA_ID, token, [campo.column]);
      expect(afterReload[campo.column]).toBeNull();
    });
  });
}
