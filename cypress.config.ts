import { defineConfig } from "cypress";

/**
 * Cypress config para os testes E2E de Membros do Projeto.
 *
 * Variáveis esperadas (env CI):
 *   - CYPRESS_BASE_URL        URL pública (preview/staging)
 *   - CYPRESS_TEST_EMAIL      coordenador
 *   - CYPRESS_TEST_PASSWORD
 *   - CYPRESS_PROJETO_ID      projeto com ao menos 1 membro removível
 *
 * Roda em paralelo com a suíte Playwright em `e2e/`; ambas validam o mesmo
 * contrato de UI para garantir cobertura cruzada.
 */
export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:5173",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10_000,
  },
});
