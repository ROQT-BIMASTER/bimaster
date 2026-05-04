/**
 * Smoke tests de permissão para Aprovações.
 *
 * Objetivo: validar **rapidamente** (poucos segundos) que o login + RLS
 * estão coerentes com o papel antes de gastar tempo no fluxo completo.
 *
 * Roda primeiro na suíte (testDir do Playwright config), de modo que se
 * a permissão básica falhar, o resto da suíte é interrompido cedo.
 *
 * Comportamento por papel (controlado por E2E_ROLE):
 *   - vendedor    → vê o card do seed (próprio); NÃO vê filtro de equipe.
 *   - supervisor  → vê o card do seed E o seletor "equipe/supervisão".
 */
import { test, expect, type Page } from "@playwright/test";

const ROLE = (process.env.E2E_ROLE ?? "vendedor").toLowerCase();
const SEED_ITEM_ID = "00000000-e2e0-0000-0000-000000000005";

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

test.describe(`@smoke Permissões — papel: ${ROLE}`, () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/central/aprovacoes");
    await expect(
      page.getByRole("heading", { name: /aprovaç(õ|o)es/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("vê o item fixo do seed (RLS permite)", async ({ page }) => {
    // Card identificado por data-aprovacao-item-id quando disponível,
    // senão por texto/atributo do seed.
    const card = page
      .locator(`[data-aprovacao-item-id="${SEED_ITEM_ID}"]`)
      .or(page.locator(`[data-testid="aprovacao-card-${SEED_ITEM_ID}"]`));

    await expect(card.first()).toBeVisible({ timeout: 15_000 });
  });

  test("controles específicos do papel aparecem corretamente", async ({ page }) => {
    const filtroEquipe = page.getByRole("button", {
      name: /equipe|supervis(ã|a)o|toda a equipe/i,
    });

    if (ROLE === "supervisor") {
      await expect(filtroEquipe.first()).toBeVisible({ timeout: 10_000 });
    } else {
      // vendedor não deve ver controle de visão de equipe.
      await expect(filtroEquipe).toHaveCount(0);
    }
  });
});
