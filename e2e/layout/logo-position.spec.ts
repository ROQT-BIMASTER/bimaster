/**
 * E2E — Presença, posição e ausência de duplicação do logo da aplicação.
 *
 * Cobre:
 *  - Login (AuthLayout): exatamente 1 logo, centralizado.
 *  - 404 / NotFound: exatamente 1 logo no canto superior esquerdo.
 *  - Dashboard (DashboardLayout, V1 e V2): exatamente 1 logo no canto
 *    superior esquerdo do header (52px), sem duplicação por sidebar/rail.
 *  - Responsivo: o logo é visível e cabe no viewport em mobile (375),
 *    tablet (768) e desktop (1280) sem estourar a largura do header.
 *
 * Variáveis de ambiente:
 *  - E2E_BASE_URL                URL do preview/staging.
 *  - E2E_TEST_EMAIL / _PASSWORD  (opcional) — habilita o cenário autenticado.
 *
 * Sem credenciais, os cenários públicos (login, 404) continuam rodando e o
 * teste do dashboard é `skip`-ado.
 */
import { test, expect, type Page } from "@playwright/test";

const LOGO = '[data-testid="app-logo"]';

type Viewport = { name: string; width: number; height: number };
const VIEWPORTS: Viewport[] = [
  { name: "mobile", width: 375, height: 720 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];

async function expectSingleLogoVisible(page: Page) {
  const logos = page.locator(LOGO);
  await expect(logos).toHaveCount(1);
  await expect(logos.first()).toBeVisible();
  // Naturalmente carregado (não broken).
  const naturalWidth = await logos.first().evaluate(
    (el) => (el as HTMLImageElement).naturalWidth,
  );
  expect(naturalWidth).toBeGreaterThan(0);
}

async function expectLogoTopLeft(page: Page, opts?: { maxLeft?: number; maxTop?: number }) {
  const maxLeft = opts?.maxLeft ?? 80;
  const maxTop = opts?.maxTop ?? 80;
  const box = await page.locator(LOGO).first().boundingBox();
  expect(box, "logo bounding box").not.toBeNull();
  if (!box) return;
  expect(box.x).toBeLessThanOrEqual(maxLeft);
  expect(box.y).toBeLessThanOrEqual(maxTop);
  // Cabe no viewport.
  const vw = page.viewportSize()?.width ?? 1280;
  expect(box.x + box.width).toBeLessThanOrEqual(vw);
}

async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) throw new Error("sem credenciais");
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe("@layout Logo — presença e posição", () => {
  for (const vp of VIEWPORTS) {
    test(`login: 1 logo visível em ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/auth/login");
      // AuthLayout monta direto; aguardamos o logo aparecer.
      await page.waitForSelector(LOGO, { timeout: 15_000 });
      await expectSingleLogoVisible(page);
      // No login o logo é centralizado, então não validamos top-left, só
      // garantimos que cabe no viewport.
      const box = await page.locator(LOGO).first().boundingBox();
      expect(box).not.toBeNull();
      if (box) expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    });

    test(`404: 1 logo no canto superior esquerdo em ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/__rota-inexistente-e2e__");
      await page.waitForSelector(LOGO, { timeout: 15_000 });
      await expectSingleLogoVisible(page);
      await expectLogoTopLeft(page);
    });
  }

  test("dashboard: 1 logo no canto superior esquerdo (sem duplicar)", async ({ page }) => {
    test.skip(
      !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
      "sem credenciais E2E — pulando cenário autenticado",
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);

    // Algumas rotas internas para garantir que o logo persiste e não duplica.
    const rotas = [
      "/dashboard/projetos/central",
      "/dashboard/projetos/minhas-tarefas",
    ];

    for (const rota of rotas) {
      await page.goto(rota);
      await page.waitForSelector(LOGO, { timeout: 20_000 });
      await expectSingleLogoVisible(page);
      await expectLogoTopLeft(page, { maxLeft: 100, maxTop: 60 });
    }
  });

  test("dashboard mobile: logo continua único e dentro do header", async ({ page }) => {
    test.skip(
      !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
      "sem credenciais E2E — pulando cenário autenticado",
    );
    await page.setViewportSize({ width: 375, height: 720 });
    await login(page);
    await page.goto("/dashboard/projetos/central");
    await page.waitForSelector(LOGO, { timeout: 20_000 });
    await expectSingleLogoVisible(page);
    const box = await page.locator(LOGO).first().boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Header é 52px; logo deve caber dentro dele.
      expect(box.height).toBeLessThanOrEqual(52);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
  });
});
