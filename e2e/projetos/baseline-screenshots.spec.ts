/**
 * PR-C0 — Baseline visual do módulo Projetos.
 *
 * Captura screenshots de referência ("golden") das telas que serão tocadas
 * pela Fase C (decomposição estrutural). A ideia é que cada PR da Fase C
 * rode esta suíte e compare contra estas baselines via
 * `expect(...).toHaveScreenshot()` para detectar regressões visuais
 * involuntárias.
 *
 * Convenções:
 *   - Sempre `fullPage: true` para capturar layout completo.
 *   - `mask` em elementos dinâmicos (datas relativas, avatares com URL
 *     assinada, contadores de notificações) para reduzir flakiness.
 *   - `animations: "disabled"` para estabilizar capturas.
 *   - `maxDiffPixelRatio: 0.02` (2%) tolera variações antialias entre
 *     headless local vs CI.
 *
 * Como atualizar baselines (após mudança visual intencional):
 *   bunx playwright test e2e/projetos/baseline-screenshots.spec.ts \
 *     --update-snapshots
 *
 * Variáveis de ambiente: ver `00-smoke-projetos.spec.ts`.
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

const SCREENSHOT_OPTS = {
  fullPage: true,
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.02,
  // Mascara elementos com conteúdo dinâmico que mudaria entre runs.
  mask: [] as ReturnType<Page["locator"]>[],
};

async function settle(page: Page) {
  // Aguarda fontes + skeleton sumir.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready);
  // Pequeno buffer para Tailwind/animations residuais.
  await page.waitForTimeout(300);
}

test.describe("@baseline Projetos — screenshots de referência (PR-C0)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("listagem /dashboard/projetos", async ({ page }) => {
    await page.goto("/dashboard/projetos");
    await expect(
      page.getByRole("heading", { name: /projetos/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await settle(page);
    await expect(page).toHaveScreenshot("projetos-listagem.png", SCREENSHOT_OPTS);
  });

  test("central de trabalho /dashboard/projetos/central", async ({ page }) => {
    await page.goto("/dashboard/projetos/central");
    await expect(
      page.getByRole("heading", { name: /central|trabalho|hoje/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await settle(page);
    await expect(page).toHaveScreenshot("projetos-central.png", SCREENSHOT_OPTS);
  });

  test("minhas tarefas /dashboard/projetos/minhas-tarefas", async ({ page }) => {
    await page.goto("/dashboard/projetos/minhas-tarefas");
    await settle(page);
    await expect(page).toHaveScreenshot(
      "projetos-minhas-tarefas.png",
      SCREENSHOT_OPTS,
    );
  });

  test("minha equipe /dashboard/projetos/minha-equipe", async ({ page }) => {
    await page.goto("/dashboard/projetos/minha-equipe");
    await settle(page);
    await expect(page).toHaveScreenshot(
      "projetos-minha-equipe.png",
      SCREENSHOT_OPTS,
    );
  });

  test("relatórios /dashboard/projetos/relatorios", async ({ page }) => {
    await page.goto("/dashboard/projetos/relatorios");
    await settle(page);
    await expect(page).toHaveScreenshot(
      "projetos-relatorios.png",
      SCREENSHOT_OPTS,
    );
  });

  test.describe("detalhe de projeto (requer E2E_PROJETO_ID)", () => {
    test.skip(!PROJETO_ID, "E2E_PROJETO_ID não configurado");

    test("kanban", async ({ page }) => {
      await page.goto(`/dashboard/projetos/${PROJETO_ID}`);
      const kanbanTab = page.getByRole("tab", { name: /kanban/i });
      await kanbanTab.click().catch(() => {});
      await settle(page);
      await expect(page).toHaveScreenshot(
        "projeto-detalhe-kanban.png",
        SCREENSHOT_OPTS,
      );
    });

    test("lista", async ({ page }) => {
      await page.goto(`/dashboard/projetos/${PROJETO_ID}`);
      await page.getByRole("tab", { name: /lista/i }).click().catch(() => {});
      await settle(page);
      await expect(page).toHaveScreenshot(
        "projeto-detalhe-lista.png",
        SCREENSHOT_OPTS,
      );
    });

    test("cronograma", async ({ page }) => {
      await page.goto(`/dashboard/projetos/${PROJETO_ID}`);
      await page
        .getByRole("tab", { name: /cronograma|gantt/i })
        .click()
        .catch(() => {});
      await settle(page);
      await expect(page).toHaveScreenshot(
        "projeto-detalhe-cronograma.png",
        SCREENSHOT_OPTS,
      );
    });
  });
});
