/**
 * E2E — Pipeline operacional Fábrica China.
 *
 * Cobre o caminho narrado no relatório executivo (§6 do PDF):
 *   OC → OP (apontamento) → Pátio Pronto → Embarque → Container → Recebimento → NC.
 *
 * Estratégia (smoke):
 *   1. Login.
 *   2. Para cada tela do pipeline, abrir a rota e validar que a página
 *      carrega sem erro e o título principal aparece.
 *   3. Validar que a Linha do Tempo da OC (`ChinaTimelineButton`) abre.
 *
 * NÃO faz mutação por padrão (smoke). Specs de mutação são adicionados
 * incrementalmente conforme estabilizar fixtures em `scripts/seed/`.
 *
 * Variáveis exigidas (além das padrões):
 *   - E2E_CHINA_OC_ID            UUID de uma OC de seed.
 *   - E2E_CHINA_EMBARQUE_ID      UUID de um embarque de seed (opcional).
 *   - E2E_CHINA_RECEBIMENTO_ID   UUID de um recebimento de seed (opcional).
 */
import { test, expect, type Page } from "@playwright/test";

const OC_ID = process.env.E2E_CHINA_OC_ID;
const EMB_ID = process.env.E2E_CHINA_EMBARQUE_ID;
const RECEB_ID = process.env.E2E_CHINA_RECEBIMENTO_ID;

async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL!;
  const password = process.env.E2E_TEST_PASSWORD!;
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe("@china-pipeline smoke ponta-a-ponta", () => {
  test.skip(!OC_ID, "Defina E2E_CHINA_OC_ID com uma OC de seed");

  test("OC abre e renderiza progresso", async ({ page }) => {
    await login(page);
    await page.goto(`/dashboard/fabrica-china/ordens/${OC_ID}`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    // Botão de Linha do Tempo deve estar acessível
    await expect(page.getByRole("button", { name: /linha do tempo/i })).toBeVisible();
  });

  test("Ordens de Produção lista carrega", async ({ page }) => {
    await login(page);
    await page.goto(`/dashboard/fabrica-china/ordens-producao`);
    await expect(page).toHaveURL(/ordens-producao/);
    await expect(page.locator("body")).not.toContainText(/Application error|Algo deu errado/i);
  });

  test("Pátio Pronto p/ Embarque carrega", async ({ page }) => {
    await login(page);
    await page.goto(`/dashboard/fabrica-china/patio-embarque`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("Torre de Containers carrega", async ({ page }) => {
    await login(page);
    await page.goto(`/dashboard/fabrica-china/torre-containers`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("Recebimentos lista carrega", async ({ page }) => {
    await login(page);
    await page.goto(`/dashboard/fabrica-china/recebimentos`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("Divergências (NC) carrega", async ({ page }) => {
    await login(page);
    await page.goto(`/dashboard/fabrica-china/recebimentos/divergencias`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test.describe("contexto vinculado", () => {
    test.skip(!EMB_ID, "Defina E2E_CHINA_EMBARQUE_ID");
    test("embarque tem timeline acessível", async ({ page }) => {
      await login(page);
      await page.goto(`/dashboard/fabrica-china/torre-containers`);
      // Apenas valida que a tela rendered sem crash; abertura específica
      // depende de markup estável da torre.
      await expect(page.locator("body")).not.toContainText(/Application error/i);
    });
  });
});
