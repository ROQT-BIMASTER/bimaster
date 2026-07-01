/**
 * E2E — Validação de upload de anexo (mp4/mov/webm inválidos) em
 * Projetos e Central de Trabalho.
 *
 * Objetivo:
 *   Garantir que a UI mostra o toast de erro correto (mensagem descritiva
 *   com tipo permitido / limite de tamanho) quando o usuário tenta enviar:
 *
 *   1. Extensão não permitida (.avi)
 *   2. MP4 acima do limite de vídeo (>100 MB)
 *   3. MP4 com magic bytes inválidos (spoof) — bloqueado por `validateFileForUpload`
 *
 *   Testado nos DOIS pontos de entrada que consomem o fluxo compartilhado
 *   `uploadTarefaAnexoToStorage`:
 *
 *     • Projetos → Drawer de tarefa (`TarefaAnexosSection` +
 *       `useProjetoTarefaDetalhe`), que passa por `UploadAnexoDialog`.
 *     • Central de Trabalho → Minhas Tarefas
 *       (`MinhasTarefaAnexos` + `useMinhasTarefaDetalhe`), upload direto
 *       sem dialog.
 *
 * Assertivas do toast (sonner):
 *   - Título contém a categoria de erro (ex.: "Arquivo muito grande",
 *     "Tipo de arquivo não permitido").
 *   - Descrição contém pelo menos UM dos hints obrigatórios: menciona
 *     limite (20 MB / 100 MB), extensão permitida ou nome da extensão
 *     bloqueada. Isso replica o contrato do `describeUploadError`.
 *   - NENHUM toast de sucesso ("Anexo enviado!") aparece.
 *
 * Env obrigatórias:
 *   E2E_BASE_URL
 *   VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *   E2E_PROJETO_ID
 *   E2E_SECAO_ID
 *   E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD  (membro do projeto, responsável
 *                                          para aparecer na Central)
 */

import { test, expect, type Page } from "@playwright/test";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BASE_URL = process.env.E2E_BASE_URL ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";
const SECAO_ID = process.env.E2E_SECAO_ID ?? "";
const OWNER = {
  email: process.env.E2E_OWNER_EMAIL ?? process.env.E2E_TEST_EMAIL ?? "",
  password: process.env.E2E_OWNER_PASSWORD ?? process.env.E2E_TEST_PASSWORD ?? "",
};

const MB = 1024 * 1024;
const MP4_FTYP = [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]; // "....ftyp"

/** Buffer com magic bytes MP4 válidos no offset 4 + padding até `sizeBytes`. */
function buildFakeMp4(sizeBytes: number): Buffer {
  const buf = Buffer.alloc(Math.max(sizeBytes, MP4_FTYP.length + 4));
  for (let i = 0; i < MP4_FTYP.length; i++) buf[i] = MP4_FTYP[i];
  return buf;
}

/** Buffer trivial para arquivos que devem ser rejeitados ANTES do magic-check. */
function buildTinyBuffer(sizeBytes = 1024): Buffer {
  return Buffer.alloc(sizeBytes);
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

async function loginUi(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/(dashboard|projetos|central)/, { timeout: 30_000 });
}

/**
 * Espera o toast do sonner aparecer com título e descrição casando os
 * regexes fornecidos. Sonner renderiza cada toast em
 * `[data-sonner-toast]` com `[data-title]` e `[data-description]`.
 */
async function expectErrorToast(
  page: Page,
  titleMatcher: RegExp,
  descriptionMatcher: RegExp,
) {
  const toast = page
    .locator('[data-sonner-toast][data-type="error"]')
    .filter({ hasText: titleMatcher })
    .first();
  await expect(toast, "toast de erro deveria aparecer").toBeVisible({ timeout: 10_000 });

  const title = (await toast.locator("[data-title]").textContent()) ?? "";
  const description = (await toast.locator("[data-description]").textContent()) ?? "";
  expect(title).toMatch(titleMatcher);
  expect(description).toMatch(descriptionMatcher);

  // Nenhum toast de sucesso deve co-existir.
  const successCount = await page
    .locator('[data-sonner-toast][data-type="success"]', { hasText: /Anexo enviado/i })
    .count();
  expect(successCount, "não deveria disparar toast de sucesso").toBe(0);
}

async function dismissAllToasts(page: Page) {
  const toasts = page.locator("[data-sonner-toast]");
  const n = await toasts.count();
  for (let i = 0; i < n; i++) {
    // sonner ignora clique fora — fechar via botão explícito quando existir.
    const close = toasts.nth(i).locator('button[aria-label*="Close" i], [data-close-button]');
    if ((await close.count()) > 0) await close.first().click().catch(() => {});
  }
  // Aguarda o buffer sonner esvaziar antes do próximo caso.
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------

test.describe("Upload — validação de anexo (mp4/mov/webm inválidos)", () => {
  test.skip(
    !BASE_URL || !SUPABASE_URL || !SUPABASE_KEY || !PROJETO_ID || !SECAO_ID,
    "E2E_BASE_URL / VITE_SUPABASE_* / E2E_PROJETO_ID / E2E_SECAO_ID obrigatórios",
  );
  test.skip(!OWNER.email || !OWNER.password, "E2E_OWNER_* obrigatório");

  let owner: SupabaseClient;
  let tarefaId = "";
  const trash: string[] = [];

  test.beforeAll(async () => {
    owner = await signIn(OWNER.email, OWNER.password);
    const uid = (await owner.auth.getUser()).data.user?.id ?? null;

    const { data, error } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e upload-validation] tarefa de teste",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        responsavel_id: uid, // aparece na Central de Trabalho do owner
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    tarefaId = (data as { id: string }).id;
    trash.push(tarefaId);
  });

  test.afterAll(async () => {
    if (trash.length) {
      await owner.from("projeto_tarefas").delete().in("id", trash);
    }
    await owner?.auth.signOut();
  });

  // -----------------------------------------------------------------------
  // Projetos → TarefaAnexosSection (com UploadAnexoDialog)
  // -----------------------------------------------------------------------

  test.describe("Projetos → drawer da tarefa", () => {
    test.beforeEach(async ({ page }) => {
      await loginUi(page, OWNER.email, OWNER.password);
      await page.goto(`/projetos/${PROJETO_ID}?tarefa=${tarefaId}`);
      // Espera a seção de anexos carregar.
      await expect(page.getByRole("heading", { name: /anexos/i }).first()).toBeVisible({
        timeout: 20_000,
      });
    });

    async function attachAndConfirm(page: Page, name: string, mime: string, buffer: Buffer) {
      // O <input type="file"> é hidden — usar setInputFiles diretamente.
      const input = page.locator('input[type="file"]').first();
      await input.setInputFiles({ name, mimeType: mime, buffer });

      // Dialog abre — confirma "Enviar sem notificar".
      const enviarBtn = page.getByRole("button", { name: /enviar sem notificar/i });
      await expect(enviarBtn).toBeVisible({ timeout: 10_000 });
      await enviarBtn.click();
    }

    test("extensão .avi é rejeitada com mensagem de tipo não permitido", async ({ page }) => {
      await attachAndConfirm(page, "clipe.avi", "video/x-msvideo", buildTinyBuffer());
      await expectErrorToast(
        page,
        /tipo de arquivo|extensão|não permitid/i,
        /mp4|mov|webm|permitid|pdf|jpg|extens/i,
      );
      await dismissAllToasts(page);
    });

    test("MP4 acima de 100 MB é rejeitado com mensagem de tamanho", async ({ page }) => {
      const big = buildFakeMp4(101 * MB);
      await attachAndConfirm(page, "grande.mp4", "video/mp4", big);
      await expectErrorToast(page, /muito grande|excede|tamanho/i, /100\s*mb|vídeo|comprim|handbrake/i);
      await dismissAllToasts(page);
    });

    test("MOV com MIME spoofado (magic bytes inválidos) é rejeitado", async ({ page }) => {
      // Buffer sem magic bytes de QuickTime → validateFileForUpload rejeita.
      await attachAndConfirm(page, "fake.mov", "video/quicktime", buildTinyBuffer(2 * MB));
      await expectErrorToast(
        page,
        /tipo|conteúdo|corromp|inválid/i,
        /mp4|mov|webm|permitid|assinatura|conteúdo/i,
      );
      await dismissAllToasts(page);
    });
  });

  // -----------------------------------------------------------------------
  // Central de Trabalho → Minhas Tarefas (upload direto, sem dialog)
  // -----------------------------------------------------------------------

  test.describe("Central de Trabalho → Minhas Tarefas", () => {
    test.beforeEach(async ({ page }) => {
      await loginUi(page, OWNER.email, OWNER.password);
      await page.goto(`/dashboard/projetos/minhas-tarefas?tarefa=${tarefaId}`);
      // Detail drawer da Minhas Tarefas — cabeçalho "Anexos" carregado
      // pelo `MinhasTarefaAnexos` (`h4` com texto "Anexos (N)").
      await expect(
        page.locator("h4").filter({ hasText: /anexos\s*\(\d+\)/i }).first(),
      ).toBeVisible({ timeout: 20_000 });
    });

    async function attachDirect(page: Page, name: string, mime: string, buffer: Buffer) {
      const input = page.locator('input[type="file"]').first();
      await input.setInputFiles({ name, mimeType: mime, buffer });
    }

    test("WEBM acima de 100 MB é rejeitado com mensagem de tamanho", async ({ page }) => {
      // WEBM: EBML magic bytes 1A 45 DF A3
      const big = Buffer.alloc(101 * MB);
      big[0] = 0x1a; big[1] = 0x45; big[2] = 0xdf; big[3] = 0xa3;
      await attachDirect(page, "captura.webm", "video/webm", big);
      await expectErrorToast(page, /muito grande|excede|tamanho/i, /100\s*mb|vídeo|comprim|handbrake/i);
      await dismissAllToasts(page);
    });

    test("extensão .mkv é rejeitada com mensagem de tipo não permitido", async ({ page }) => {
      await attachDirect(page, "clipe.mkv", "video/x-matroska", buildTinyBuffer());
      await expectErrorToast(
        page,
        /tipo de arquivo|extensão|não permitid/i,
        /mp4|mov|webm|permitid|pdf|jpg|extens/i,
      );
      await dismissAllToasts(page);
    });
  });
});
