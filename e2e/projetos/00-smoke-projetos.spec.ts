/**
 * PR-C0 — Smoke do módulo Projetos.
 *
 * Objetivo: garantir, em poucos segundos, que as principais rotas do módulo
 * Projetos carregam SEM erro 500 / tela branca / crash de boundary ANTES de
 * qualquer refactor estrutural da Fase C (decomposição de
 * ProjetoTarefaDetalhe / ProjetoTarefaRow / TarefaFocusMode).
 *
 * Esta suíte é intencionalmente "shallow": valida render, heading principal e
 * ausência de mensagens de erro fatais. A validação visual fica em
 * `baseline-screenshots.spec.ts`.
 *
 * Variáveis de ambiente:
 *   - E2E_BASE_URL
 *   - E2E_TEST_EMAIL
 *   - E2E_TEST_PASSWORD
 *   - E2E_PROJETO_ID (opcional) — projeto usado para smoke do detalhe.
 */
import { test, expect, type Page } from "@playwright/test";

const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";

async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_TEST_EMAIL / E2E_TEST_PASSWORD ausentes");
  }
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function expectNoFatalError(page: Page) {
  // ErrorBoundary global do app
  await expect(page.getByText(/algo deu errado|erro inesperado/i)).toHaveCount(0);
  // 404 do React Router
  await expect(page.getByText(/p(á|a)gina n(ã|a)o encontrada/i)).toHaveCount(0);
}

test.describe("@smoke Projetos — rotas principais", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("/dashboard/projetos abre e lista projetos", async ({ page }) => {
    await page.goto("/dashboard/projetos");
    await expect(
      page.getByRole("heading", { name: /projetos/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoFatalError(page);
  });

  test("/dashboard/projetos/central abre Central de Trabalho", async ({ page }) => {
    await page.goto("/dashboard/projetos/central");
    await expect(
      page.getByRole("heading", { name: /central|trabalho|hoje/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoFatalError(page);
  });

  test("/dashboard/projetos/minhas-tarefas abre", async ({ page }) => {
    await page.goto("/dashboard/projetos/minhas-tarefas");
    await expect(
      page.getByRole("heading", { name: /minhas tarefas|tarefas/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoFatalError(page);
  });

  test("/dashboard/projetos/minha-equipe abre", async ({ page }) => {
    await page.goto("/dashboard/projetos/minha-equipe");
    await expect(
      page.getByRole("heading", { name: /equipe|minha equipe/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoFatalError(page);
  });

  test("/dashboard/projetos/relatorios abre", async ({ page }) => {
    await page.goto("/dashboard/projetos/relatorios");
    await expect(
      page.getByRole("heading", { name: /relat(ó|o)rios/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoFatalError(page);
  });

  test("detalhe de projeto abre (se E2E_PROJETO_ID configurado)", async ({ page }) => {
    test.skip(!PROJETO_ID, "E2E_PROJETO_ID não configurado — pulando smoke do detalhe");
    await page.goto(`/dashboard/projetos/${PROJETO_ID}`);
    // Aguarda a shell do detalhe (tabs Kanban/Lista/Cronograma)
    await expect(
      page.getByRole("tab", { name: /kanban|lista|cronograma/i }).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expectNoFatalError(page);
  });
});
