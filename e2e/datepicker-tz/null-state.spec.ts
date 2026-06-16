/**
 * E2E — Estado null/vazio dos datepickers da tarefa.
 *
 * Garante que, quando "Data prazo" e "Próxima ação" estão NULL no backend:
 *   1. A UI exibe o placeholder ("Definir prazo" / "Definir próxima ação"),
 *      não uma data fantasma com shift de fuso.
 *   2. O GET via PostgREST devolve `null` (não `"1969-12-31"` nem
 *      `"1970-01-01"`, que são as assinaturas clássicas de bug UTC).
 *   3. Após reload, ambos os lados continuam null/placeholder.
 *
 * Roda nos 3 fusos definidos em playwright.config.ts (SP, UTC, Tokyo).
 */
import { test, expect } from "@playwright/test";
import { login, getAccessToken } from "./helpers/auth";
import {
  getTarefaDatas,
  patchTarefaDatas,
  type TarefaDateColumn,
} from "./helpers/supabaseRest";

const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";
const TAREFA_ID = process.env.E2E_TAREFA_ID ?? "";

const CAMPOS: Array<{
  column: TarefaDateColumn;
  fieldName: string;
  fieldLabelRegex: RegExp;
  placeholderRegex: RegExp;
}> = [
  {
    column: "data_prazo",
    fieldName: "Data prazo",
    fieldLabelRegex: /data prazo/i,
    // Componente exibe "Definir prazo" quando vazio.
    placeholderRegex: /definir prazo|definir data/i,
  },
  {
    column: "data_proxima_acao",
    fieldName: "Próxima ação",
    fieldLabelRegex: /pr(ó|o)xima a(ç|c)(ã|a)o/i,
    placeholderRegex: /definir pr(ó|o)xima a(ç|c)(ã|a)o/i,
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

for (const campo of CAMPOS) {
  test.describe(`Datepicker @ ${campo.fieldName} — estado null`, () => {
    test(`UI e backend permanecem null sincronizados`, async ({ page }) => {
      await login(page);
      const token = await getAccessToken(page);

      // 1. Seed: força NULL no backend antes de abrir a tela.
      await patchTarefaDatas(TAREFA_ID, token, { [campo.column]: null });
      const seeded = await getTarefaDatas(TAREFA_ID, token, [campo.column]);
      expect(seeded[campo.column]).toBeNull();

      // 2. Abrir a tarefa e validar que o botão mostra placeholder, não data.
      await page.goto(`/dashboard/projetos/${PROJETO_ID}?tarefa=${TAREFA_ID}`);
      const label = page.getByText(campo.fieldLabelRegex).first();
      await expect(label).toBeVisible({ timeout: 30_000 });

      const trigger = label.locator("xpath=following::button[1]");
      await expect(trigger).toContainText(campo.placeholderRegex);
      // Salvaguardas anti-shift: nenhuma "data fantasma" UTC clássica.
      await expect(trigger).not.toContainText(/1969|1970/);
      await expect(trigger).not.toContainText(/\b\d{1,2}\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i);

      // 3. Reload: continua null em ambos os lados.
      await page.reload();
      await expect(page.getByText(campo.fieldLabelRegex).first()).toBeVisible({ timeout: 30_000 });
      const triggerAfter = page
        .getByText(campo.fieldLabelRegex)
        .first()
        .locator("xpath=following::button[1]");
      await expect(triggerAfter).toContainText(campo.placeholderRegex);

      const afterReload = await getTarefaDatas(TAREFA_ID, token, [campo.column]);
      expect(afterReload[campo.column]).toBeNull();
    });
  });
}
