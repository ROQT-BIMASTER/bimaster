/**
 * E2E — China: upload → persistência → preview → download.
 *
 * Cobre o fluxo hardenizado em `useUploadChinaDocumento`:
 *   1. Login.
 *   2. Abre a submissão China (`E2E_CHINA_SUBMISSAO_ID`) na Caixa de Entrada.
 *   3. Faz upload de um PDF de fixture (magic bytes válidos) em um item de
 *      checklist conhecido (`E2E_CHINA_CHECKLIST_TIPO`, default: `outros`).
 *   4. Aguarda toast de sucesso, valida persistência via REST (`china_produto_documentos`).
 *   5. Abre o preview (`ChinaDocPreviewDialog`) e valida estado `ready`.
 *   6. Aciona o download e valida que o `Download` event do Playwright dispara
 *      com filename original preservado.
 *
 * Roda no mesmo job que os demais Playwright (dev/staging/produção via
 * `E2E_BASE_URL`). Para produção, exige seed estável apontada pelas envs.
 *
 * Variáveis obrigatórias:
 *   - E2E_BASE_URL
 *   - E2E_TEST_EMAIL / E2E_TEST_PASSWORD
 *   - E2E_SUPABASE_URL / E2E_SUPABASE_ANON_KEY  (para verificação REST)
 *   - E2E_CHINA_SUBMISSAO_ID                    (UUID com checklist disponível)
 * Opcionais:
 *   - E2E_CHINA_CHECKLIST_TIPO   (default: "outros")
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.E2E_BASE_URL;
const SUBM = process.env.E2E_CHINA_SUBMISSAO_ID;
const TIPO = process.env.E2E_CHINA_CHECKLIST_TIPO ?? "outros";
const SB_URL = process.env.E2E_SUPABASE_URL;
const SB_KEY = process.env.E2E_SUPABASE_ANON_KEY;
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASS = process.env.E2E_TEST_PASSWORD;

const FIXTURE = join(__dirname, "fixtures", "sample.pdf");

async function login(page: Page) {
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(EMAIL!);
  await page.getByLabel(/senha/i).fill(PASS!);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function authToken(page: Page): Promise<string> {
  // Recupera o access_token da sessão Supabase persistida em localStorage.
  const token = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
        try {
          const v = JSON.parse(localStorage.getItem(k) ?? "{}");
          return v?.access_token ?? null;
        } catch { /* ignore */ }
      }
    }
    return null;
  });
  expect(token, "access_token na sessão").toBeTruthy();
  return token as string;
}

test.describe("@china-docs upload → DB → preview → download", () => {
  test.skip(!BASE || !SUBM || !SB_URL || !SB_KEY || !EMAIL || !PASS,
    "Defina E2E_BASE_URL, E2E_TEST_EMAIL/PASSWORD, E2E_SUPABASE_URL/ANON_KEY e E2E_CHINA_SUBMISSAO_ID");

  test("fluxo completo (upload → persiste → preview → download)", async ({ page }) => {
    await login(page);

    // 1) Abrir a submissão na caixa de entrada
    await page.goto(`/dashboard/fabrica-china/caixa-entrada?submissaoId=${SUBM}`);
    await expect(page.locator("body")).not.toContainText(/Application error/i);

    // 2) Localizar o slot de upload do tipo alvo (data-testid recomendado:
    //    `china-upload-${tipo}`; fallback: input file visível na seção)
    const fileInput = page
      .locator(`[data-testid="china-upload-${TIPO}"] input[type="file"], input[type="file"]`)
      .first();
    await fileInput.waitFor({ state: "attached", timeout: 15_000 });

    const before = Date.now();
    const fixtureBuf = readFileSync(FIXTURE);
    await fileInput.setInputFiles({
      name: "Relatório Teste E2E.pdf",
      mimeType: "application/pdf",
      buffer: fixtureBuf,
    });

    // 3) Aguardar toast de sucesso
    await expect(page.getByText(/documento.*(enviado|salvo|carregado)/i)).toBeVisible({ timeout: 60_000 });

    // 4) Verificar persistência via REST (RLS-safe, com token do usuário)
    const token = await authToken(page);
    const url =
      `${SB_URL}/rest/v1/china_produto_documentos` +
      `?select=id,arquivo_path,arquivo_nome,tipo_documento,created_at` +
      `&submissao_id=eq.${SUBM}&tipo_documento=eq.${TIPO}` +
      `&order=created_at.desc&limit=1`;
    const res = await page.request.get(url, {
      headers: {
        apikey: SB_KEY!,
        Authorization: `Bearer ${token}`,
      },
    });
    expect(res.ok(), `GET ${url} → ${res.status()}`).toBeTruthy();
    const rows = await res.json();
    expect(Array.isArray(rows) && rows.length > 0, "documento deve existir no DB").toBeTruthy();
    const doc = rows[0];
    expect(doc.arquivo_path, "arquivo_path preenchido").toBeTruthy();
    expect(new Date(doc.created_at).getTime()).toBeGreaterThanOrEqual(before - 5_000);

    // 5) Abrir o preview — clicar no item recém-criado
    //    Usa o nome do arquivo como âncora (pode ser sanitizado, então busca parcial).
    const trigger = page.getByText(/Relat[óo]rio Teste E2E/i).first();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    // estado "ready" = iframe / imagem carregada, sem mensagem de erro
    await expect(dialog.getByText(/erro|falha/i)).toHaveCount(0);

    // 6) Disparar download e validar filename
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      dialog.getByRole("button", { name: /baixar|download/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/Relat[óo]rio Teste E2E\.pdf$/i);
  });
});
