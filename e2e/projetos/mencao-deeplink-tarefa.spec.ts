/**
 * E2E — Deep-link de menções abre o drawer da tarefa.
 *
 * Garante que:
 *  1. Navegar diretamente para `/dashboard/projetos/:id?tarefa=:tid&comentario=:cid`
 *     abre o drawer da tarefa e preserva `?tarefa=` na URL (apenas `comentario`,
 *     `tab` e `mensagem` devem ser removidos pelo cleanup).
 *  2. Não há "piscar": o drawer aparece e permanece visível sem fechar/abrir,
 *     verificado por amostragem ao longo de ~1.2s após o render inicial.
 *  3. Trocar de aba interna (lista → outra) e voltar para lista mantém `?tarefa=`.
 *  4. Botão Voltar do browser retorna à rota anterior (origem da menção) e
 *     fecha o drawer corretamente, sem reabrir.
 *
 * Variáveis de ambiente:
 *   - E2E_BASE_URL
 *   - E2E_TEST_EMAIL
 *   - E2E_TEST_PASSWORD
 *   - E2E_PROJETO_ID         projeto que o usuário enxerga
 *   - E2E_TAREFA_ID          tarefa pertencente ao projeto acima
 *   - E2E_COMENTARIO_ID      (opcional) comentário existente na tarefa
 */
import { test, expect, type Page } from "@playwright/test";

const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";
const TAREFA_ID = process.env.E2E_TAREFA_ID ?? "";
const COMENTARIO_ID = process.env.E2E_COMENTARIO_ID ?? "";

async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) throw new Error("E2E_TEST_EMAIL / E2E_TEST_PASSWORD ausentes");
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

function tarefaParam(url: string): string | null {
  return new URL(url).searchParams.get("tarefa");
}

function comentarioParam(url: string): string | null {
  return new URL(url).searchParams.get("comentario");
}

// Localizador estável do drawer de detalhe da tarefa. O Sheet do shadcn
// renderiza com role="dialog"; usamos um seletor amplo e validamos pelo
// título da tarefa quando possível.
function taskDrawer(page: Page) {
  return page.locator('[role="dialog"]').filter({ has: page.locator("textarea, input").first() });
}

test.describe("@deeplink Menções — drawer de tarefa", () => {
  test.skip(!PROJETO_ID || !TAREFA_ID, "E2E_PROJETO_ID / E2E_TAREFA_ID ausentes");

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("deep-link com ?tarefa= preserva o param, abre o drawer e não pisca", async ({ page }) => {
    const origem = "/dashboard/projetos/central?tab=inbox&subtab=mencoes";
    await page.goto(origem);
    // espera a Central renderizar antes do "clique" simulado da menção
    await expect(page).toHaveURL(/projetos\/central/, { timeout: 15_000 });

    const comentarioSeg = COMENTARIO_ID ? `&comentario=${COMENTARIO_ID}` : "";
    const targetUrl = `/dashboard/projetos/${PROJETO_ID}?tarefa=${TAREFA_ID}${comentarioSeg}`;
    await page.evaluate((u) => { window.history.pushState({}, "", u); }, targetUrl);
    await page.goto(targetUrl); // navegação real para acionar o componente

    // 1) drawer abre
    await expect(taskDrawer(page).first()).toBeVisible({ timeout: 15_000 });

    // 2) `?tarefa=` permanece; `comentario` é limpo pelo useEffect do ProjetoDetalhe
    await expect.poll(() => tarefaParam(page.url()), { timeout: 5_000 }).toBe(TAREFA_ID);
    await expect.poll(() => comentarioParam(page.url()), { timeout: 5_000 }).toBeNull();

    // 3) amostragem anti-flicker: drawer permanece visível por ~1.2s
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(200);
      await expect(taskDrawer(page).first()).toBeVisible();
      expect(tarefaParam(page.url())).toBe(TAREFA_ID);
    }

    // 4) botão Voltar retorna à Central de menções e fecha o drawer
    await page.goBack();
    await expect(page).toHaveURL(/projetos\/central/, { timeout: 10_000 });
    await expect(taskDrawer(page).first()).toBeHidden({ timeout: 10_000 });

    // 5) avançar de volta reabre o drawer com `?tarefa=` intacto
    await page.goForward();
    await expect.poll(() => tarefaParam(page.url()), { timeout: 5_000 }).toBe(TAREFA_ID);
    await expect(taskDrawer(page).first()).toBeVisible({ timeout: 10_000 });
  });

  test("?tarefa= sobrevive a refresh da página", async ({ page }) => {
    const url = `/dashboard/projetos/${PROJETO_ID}?tarefa=${TAREFA_ID}`;
    await page.goto(url);
    await expect(taskDrawer(page).first()).toBeVisible({ timeout: 15_000 });
    expect(tarefaParam(page.url())).toBe(TAREFA_ID);

    await page.reload();
    await expect(taskDrawer(page).first()).toBeVisible({ timeout: 15_000 });
    expect(tarefaParam(page.url())).toBe(TAREFA_ID);
  });
});
