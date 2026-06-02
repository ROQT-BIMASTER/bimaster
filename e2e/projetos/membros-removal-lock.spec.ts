/**
 * E2E — Membros do Projeto: trava de interações durante remoção.
 *
 * Garante que enquanto o estado "Removendo {nome}…" está ativo:
 *  - Esc não fecha o AlertDialog nem o Dialog pai.
 *  - Clique fora do AlertDialog não fecha.
 *  - Tab/Shift+Tab não escapam para fora do AlertDialog (focus trap Radix).
 *  - A live region anuncia "Removendo …" e o resultado.
 *  - Em caso de erro, o AlertDialog permanece aberto com botão "Tentar novamente".
 *
 * Variáveis:
 *   - E2E_BASE_URL
 *   - E2E_TEST_EMAIL / E2E_TEST_PASSWORD  (coordenador do projeto)
 *   - E2E_PROJETO_ID  (projeto com ao menos 1 membro removível)
 */
import { test, expect, type Page } from "@playwright/test";

const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";

async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) throw new Error("E2E_TEST_EMAIL/PASSWORD ausentes");
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function openMembrosDialog(page: Page) {
  await page.goto(`/dashboard/projetos/${PROJETO_ID}`);
  // Abre a modal Membros do Projeto (botão pode variar; tenta por nome acessível).
  await page.getByRole("button", { name: /membros|equipe/i }).first().click();
  await expect(page.getByRole("dialog", { name: /membros do projeto/i }))
    .toBeVisible({ timeout: 10_000 });
}

test.describe("@membros Remoção de membro — trava de interações", () => {
  test.skip(!PROJETO_ID, "E2E_PROJETO_ID não definido");

  test.beforeEach(async ({ page }) => {
    await login(page);
    await openMembrosDialog(page);
  });

  test("intercepta DELETE e mantém modal travada durante remoção", async ({ page }) => {
    // Atrasa a chamada de remoção em 3s para podermos exercer a trava.
    await page.route(/projeto_membros/i, async (route) => {
      if (route.request().method() === "DELETE") {
        await new Promise((r) => setTimeout(r, 3000));
      }
      await route.continue();
    });

    // Clica no botão de remover do primeiro membro removível.
    const removeBtn = page.getByRole("button", { name: /remover do projeto/i }).first();
    await removeBtn.click();

    // Confirma no AlertDialog.
    const alert = page.getByRole("alertdialog");
    await expect(alert).toBeVisible();
    await alert.getByRole("button", { name: /^remover$/i }).click();

    // 1) Overlay "Removendo …" aparece.
    const removingOverlay = page.getByTestId("alert-removing-status");
    await expect(removingOverlay).toBeVisible();

    // 2) Live region anuncia o início.
    await expect(page.getByTestId("membros-live-region"))
      .toContainText(/removendo/i);

    // 3) Esc não fecha.
    await page.keyboard.press("Escape");
    await expect(alert).toBeVisible();
    await expect(page.getByRole("dialog", { name: /membros do projeto/i })).toBeVisible();

    // 4) Clique fora não fecha (Radix bloqueia por padrão; reforçado por preventDefault).
    await page.mouse.click(5, 5);
    await expect(alert).toBeVisible();

    // 5) Tab/Shift+Tab permanecem dentro do AlertDialog (focus trap Radix).
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    const focusedInAlert = await alert.evaluate((el) => el.contains(document.activeElement));
    expect(focusedInAlert).toBe(true);
    for (let i = 0; i < 4; i++) await page.keyboard.press("Shift+Tab");
    const stillInAlert = await alert.evaluate((el) => el.contains(document.activeElement));
    expect(stillInAlert).toBe(true);

    // 6) Conclui: AlertDialog fecha, live region anuncia sucesso.
    await expect(alert).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId("membros-live-region")).toContainText(/sucesso/i);
    await expect(page.getByRole("dialog", { name: /membros do projeto/i })).toBeVisible();
  });

  test("erro mantém AlertDialog aberto e exibe 'Tentar novamente'", async ({ page }) => {
    // Força 500 na primeira tentativa de DELETE.
    let calls = 0;
    await page.route(/projeto_membros/i, async (route) => {
      if (route.request().method() === "DELETE") {
        calls++;
        if (calls === 1) {
          return route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ message: "Falha simulada de servidor" }),
          });
        }
      }
      await route.continue();
    });

    await page.getByRole("button", { name: /remover do projeto/i }).first().click();
    const alert = page.getByRole("alertdialog");
    await alert.getByRole("button", { name: /^remover$/i }).click();

    // Erro aparece, live region anuncia, botão muda para "Tentar novamente".
    await expect(page.getByTestId("remove-error")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("membros-live-region")).toContainText(/falha|tentar novamente/i);
    await expect(alert.getByRole("button", { name: /tentar novamente/i })).toBeVisible();

    // Retry funciona e fecha o AlertDialog.
    await alert.getByRole("button", { name: /tentar novamente/i }).click();
    await expect(alert).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId("membros-live-region")).toContainText(/sucesso/i);
  });
});
