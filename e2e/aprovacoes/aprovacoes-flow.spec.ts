import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — Fluxo Central de Aprovações.
 *
 * Cobre:
 *  1. Login com usuário de teste.
 *  2. Navegação para /dashboard/central/aprovacoes.
 *  3. Abertura do drawer de um item.
 *  4. Abertura do HistoricoItemDialog.
 *  5. Submissão de comentário válido (timeline atualiza).
 *  6. Caso negativo: comentário vazio mantém botão desabilitado.
 *
 * Screenshots intermediários são anexados ao relatório via test.info().attach.
 * Em caso de falha, o Playwright já captura screenshot/video/trace automaticamente
 * (ver playwright.config.ts).
 */

const COMENTARIO_VALIDO = `Teste e2e CI ${new Date().toISOString()}`;

async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL / E2E_TEST_PASSWORD não definidos no ambiente do CI",
    );
  }

  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function attachScreenshot(page: Page, name: string) {
  const buf = await page.screenshot({ fullPage: true });
  await test.info().attach(name, { body: buf, contentType: "image/png" });
}

test.describe("Central de Aprovações — fluxo principal", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("navega, abre drawer, vê histórico e registra comentário", async ({
    page,
  }) => {
    await test.step("Acessar Central de Aprovações", async () => {
      await page.goto("/dashboard/central/aprovacoes");
      await expect(
        page.getByRole("heading", { name: /aprovaç(õ|o)es/i }).first(),
      ).toBeVisible();
      await attachScreenshot(page, "01-central-aprovacoes");
    });

    await test.step("Abrir o primeiro card do Kanban", async () => {
      const primeiroCard = page
        .locator('[data-testid="aprovacao-card"], [data-aprovacao-card]')
        .first();
      // Fallback para projetos sem data-testid: clica no primeiro card visível.
      if ((await primeiroCard.count()) === 0) {
        await page
          .locator("article, [role='button']")
          .filter({ hasText: /./ })
          .first()
          .click();
      } else {
        await primeiroCard.click();
      }

      await expect(
        page.getByRole("dialog").or(page.locator("[role='dialog']")),
      ).toBeVisible({ timeout: 10_000 });
      await attachScreenshot(page, "02-drawer-aberto");
    });

    await test.step("Abrir HistoricoItemDialog", async () => {
      await page
        .getByRole("button", { name: /ver hist(ó|o)rico do item/i })
        .click();
      await expect(
        page.getByRole("heading", { name: /hist(ó|o)rico do item/i }),
      ).toBeVisible();
      await attachScreenshot(page, "03-historico-aberto");
    });

    await test.step("Botão Comentar inicia desabilitado (campo vazio)", async () => {
      const btn = page.getByRole("button", { name: /^comentar$/i });
      await expect(btn).toBeDisabled();
    });

    await test.step("Whitespace mantém botão desabilitado", async () => {
      const textarea = page.getByPlaceholder(/escreva uma observa(ç|c)(ã|a)o/i);
      await textarea.fill("    ");
      await expect(
        page.getByRole("button", { name: /^comentar$/i }),
      ).toBeDisabled();
      await textarea.fill("");
    });

    await test.step("Comentário válido é registrado e aparece na timeline", async () => {
      const textarea = page.getByPlaceholder(/escreva uma observa(ç|c)(ã|a)o/i);
      await textarea.fill(COMENTARIO_VALIDO);

      await page.getByRole("button", { name: /^comentar$/i }).click();

      // Toast de sucesso
      await expect(
        page.getByText(/coment(á|a)rio registrado no hist(ó|o)rico/i),
      ).toBeVisible({ timeout: 10_000 });

      // Nova entrada na timeline
      await expect(page.getByText(COMENTARIO_VALIDO).first()).toBeVisible({
        timeout: 10_000,
      });
      await attachScreenshot(page, "04-comentario-na-timeline");
    });
  });
});
