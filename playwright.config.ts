import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config para testes e2e do fluxo de Aprovações.
 *
 * Variáveis de ambiente esperadas (definir como secrets no GitHub):
 * - E2E_BASE_URL          URL pública do preview/staging (ex.: https://id-preview--<id>.lovable.app)
 * - E2E_TEST_EMAIL        usuário com role suficiente para abrir Central de Aprovações
 * - E2E_TEST_PASSWORD     senha do usuário acima
 *
 * Saídas:
 * - playwright-report/    relatório HTML
 * - test-results/         screenshots, vídeos e traces de cada falha
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["github"],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
