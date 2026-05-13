/**
 * E2E — Linha do Tempo (Fábrica China) × Caixa de Entrada.
 *
 * Garante que mudanças nas tabelas relacionadas (`china_produto_documentos`,
 * `china_checklist_*`) atualizam **em tempo real**, sem divergência, tanto a
 * Linha do Tempo quanto a Caixa de Entrada.
 *
 * Variáveis de ambiente exigidas (além das padrões em playwright.config.ts):
 *   - E2E_TEST_EMAIL / E2E_TEST_PASSWORD — usuário com acesso ao módulo China.
 *   - E2E_CHINA_SUBMISSAO_ID            — UUID de uma submissão de seed.
 *   - E2E_SUPABASE_URL                  — URL pública (VITE_SUPABASE_URL).
 *   - E2E_SUPABASE_SERVICE_ROLE         — service-role key (apenas em CI).
 *
 * Estratégia:
 *   1. Abre a Caixa de Entrada e a Linha do Tempo lado a lado (duas páginas).
 *   2. Lê os contadores `Pendentes` e `Enviados` de cada uma.
 *   3. Faz uma mutação direta no backend (insere/remove um doc de teste).
 *   4. Aguarda <= 10s e revalida que ambos os contadores mudaram juntos
 *      mantendo a invariante `total = pendentes + enviados`.
 *   5. Ao final, restaura o estado original.
 */
import { test, expect, type Page, request } from "@playwright/test";

const SUBMISSAO_ID = process.env.E2E_CHINA_SUBMISSAO_ID;
const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_ROLE = process.env.E2E_SUPABASE_SERVICE_ROLE;

test.describe("@china-timeline contadores em tempo real", () => {
  test.skip(
    !SUBMISSAO_ID || !SUPABASE_URL || !SERVICE_ROLE,
    "Variáveis E2E_CHINA_SUBMISSAO_ID / E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE ausentes",
  );

  async function login(page: Page) {
    const email = process.env.E2E_TEST_EMAIL!;
    const password = process.env.E2E_TEST_PASSWORD!;
    await page.goto("/auth");
    await page.getByLabel(/e-?mail/i).fill(email);
    await page.getByLabel(/senha/i).fill(password);
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  }

  /** Lê inteiros das DataRows visíveis em uma página da Linha do Tempo. */
  async function readTimelineCounters(page: Page) {
    const total = await page.getByTestId("timeline-stage2-total").innerText().catch(() => "0");
    const pendentes = await page.getByTestId("timeline-stage2-pendentes").innerText().catch(() => "0");
    const enviados = await page.getByTestId("timeline-stage3-enviados").innerText().catch(() => "0");
    return {
      total: parseInt(total, 10) || 0,
      pendentes: parseInt(pendentes, 10) || 0,
      enviados: parseInt(enviados, 10) || 0,
    };
  }

  /** Lê o contador agregado da Caixa de Entrada para a submissão. */
  async function readMailboxCounters(page: Page) {
    const card = page.locator(`[data-mailbox-submissao-id="${SUBMISSAO_ID}"]`);
    await expect(card.first()).toBeVisible({ timeout: 15_000 });
    const pendentes = await card.getByTestId("mailbox-pendentes").innerText().catch(() => "0");
    const enviados = await card.getByTestId("mailbox-enviados").innerText().catch(() => "0");
    return {
      pendentes: parseInt(pendentes, 10) || 0,
      enviados: parseInt(enviados, 10) || 0,
    };
  }

  test("inserir documento atualiza contadores em ambos os ambientes", async ({ browser }) => {
    const ctx = await browser.newContext();
    const timelinePage = await ctx.newPage();
    const mailboxPage = await ctx.newPage();

    await login(timelinePage);
    await login(mailboxPage);

    await timelinePage.goto(`/dashboard/fabrica-china/submissao/${SUBMISSAO_ID}/timeline`);
    await mailboxPage.goto(`/dashboard/fabrica-china/caixa-entrada?folder=pending_brazil`);

    // Não exibir banner de inconsistência no estado inicial.
    await expect(timelinePage.getByTestId("timeline-inconsistency-banner")).toHaveCount(0);

    const before = await readTimelineCounters(timelinePage);
    const beforeMailbox = await readMailboxCounters(mailboxPage);
    expect(before.total).toBe(before.pendentes + before.enviados);

    // Insere um documento de teste via service-role (bypassa RLS).
    const api = await request.newContext({ baseURL: SUPABASE_URL });
    const tipo = `__e2e_${Date.now()}`;
    const insertRes = await api.post(`/rest/v1/china_produto_documentos`, {
      headers: {
        apikey: SERVICE_ROLE!,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      data: {
        submissao_id: SUBMISSAO_ID,
        tipo_documento: tipo,
        status: "enviado",
        nome_arquivo: "e2e.pdf",
      },
    });
    expect(insertRes.ok()).toBeTruthy();
    const inserted = (await insertRes.json())[0];

    try {
      // Realtime: ambos os contadores devem refletir +1 em "enviados".
      await expect
        .poll(async () => (await readTimelineCounters(timelinePage)).enviados, { timeout: 15_000 })
        .toBe(before.enviados + 1);

      await expect
        .poll(async () => (await readMailboxCounters(mailboxPage)).enviados, { timeout: 15_000 })
        .toBe(beforeMailbox.enviados + 1);

      const after = await readTimelineCounters(timelinePage);
      const afterMailbox = await readMailboxCounters(mailboxPage);

      // Invariante de consistência preservada após a mutação.
      expect(after.total).toBe(after.pendentes + after.enviados);
      expect(after.enviados).toBe(afterMailbox.enviados);
      // Banner de inconsistência continua oculto.
      await expect(timelinePage.getByTestId("timeline-inconsistency-banner")).toHaveCount(0);
    } finally {
      // Limpa o documento de teste.
      await api.delete(`/rest/v1/china_produto_documentos?id=eq.${inserted.id}`, {
        headers: { apikey: SERVICE_ROLE!, Authorization: `Bearer ${SERVICE_ROLE}` },
      });
      await api.dispose();
    }
  });
});
