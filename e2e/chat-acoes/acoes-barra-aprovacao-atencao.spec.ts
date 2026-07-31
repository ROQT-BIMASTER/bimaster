/**
 * E2E — Barra de ações do chat (ChatComposerActionsBar) e fluxo
 * "clique → resultado" de Solicitar aprovação / Chamar atenção.
 *
 * Contextos cobertos (paridade obrigatória entre todos):
 *   1. Hub de Chat            → /dashboard/chat (aba Pessoas)
 *   2. Painel lateral         → drawer de detalhe da tarefa (aba Chat)
 *   3. Modo Foco              → botão "Foco" dentro do drawer
 *   4. Processos              → /dashboard/suporte/processos/:id (aba Chat)
 *
 * Invariantes validadas em cada contexto:
 *   - A barra expõe os botões padrão com os mesmos aria-labels
 *     ("Solicitar aprovação", "Chamar atenção (mensagem urgente)", "Inserir emoji").
 *   - Clicar em "Solicitar aprovação" resulta no diálogo
 *     "Solicitar aprovação" aberto (direto no hub; via conversa vinculada
 *     e deep-link ?abrir=aprovacao nos escopos tarefa/processo).
 *   - Clicar em "Chamar atenção" resulta no diálogo
 *     "Chamar atenção da equipe".
 *   - O deep-link é higienizado da URL após abrir (sem ?abrir= remanescente).
 *
 * Variáveis de ambiente:
 *   E2E_BASE_URL, E2E_TEST_EMAIL, E2E_TEST_PASSWORD  (obrigatórias)
 *   E2E_PROJETO_ID   uuid de projeto com ao menos 1 tarefa (contextos 2 e 3)
 *   E2E_TAREFA_ID    uuid de tarefa específica (opcional; senão usa a 1ª do quadro)
 *   E2E_PROCESSO_ID  uuid de processo do Suporte (contexto 4)
 */
import { test, expect, type Page } from "@playwright/test";

const PROJETO_ID = process.env.E2E_PROJETO_ID;
const TAREFA_ID = process.env.E2E_TAREFA_ID;
const PROCESSO_ID = process.env.E2E_PROCESSO_ID;

const LBL_APROVACAO = "Solicitar aprovação";
const LBL_URGENTE = "Chamar atenção (mensagem urgente)";
const LBL_EMOJI = "Inserir emoji";

const TITULO_DIALOG_APROVACAO = /solicitar aprova(ç|c)(ã|a)o/i;
const TITULO_DIALOG_URGENTE = /chamar aten(ç|c)(ã|a)o da equipe/i;

async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_TEST_EMAIL / E2E_TEST_PASSWORD ausentes no ambiente");
  }
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function attach(page: Page, name: string) {
  await test.info().attach(name, {
    body: await page.screenshot(),
    contentType: "image/png",
  });
}

/** Escopo raiz da barra de ações mais próxima do composer visível. */
function barraAcoes(page: Page) {
  return page.getByRole("button", { name: LBL_APROVACAO }).last();
}

/** Verifica paridade dos botões padrão no contexto atual. */
async function validarBarraPadrao(page: Page, contexto: string) {
  await expect(
    page.getByRole("button", { name: LBL_APROVACAO }).last(),
    `${contexto}: botão de aprovação ausente`,
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: LBL_URGENTE }).last(),
    `${contexto}: botão de chamar atenção ausente`,
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: LBL_EMOJI }).last(),
    `${contexto}: botão de emoji ausente`,
  ).toBeVisible();
}

/**
 * Clica na ação e valida o resultado final: diálogo correspondente aberto.
 * Nos escopos vinculados (tarefa/processo) há navegação para o hub de chat
 * com deep-link, que o ChatLayout consome e limpa da URL.
 */
async function clicarEValidarResultado(
  page: Page,
  acao: "aprovacao" | "urgente",
  contexto: string,
) {
  const label = acao === "aprovacao" ? LBL_APROVACAO : LBL_URGENTE;
  const titulo =
    acao === "aprovacao" ? TITULO_DIALOG_APROVACAO : TITULO_DIALOG_URGENTE;

  await page.getByRole("button", { name: label }).last().click();

  const dialog = page.getByRole("dialog").filter({ hasText: titulo });
  await expect(dialog, `${contexto}: diálogo de ${acao} não abriu`).toBeVisible({
    timeout: 20_000,
  });
  await attach(page, `${contexto}-${acao}`);

  // A URL nunca deve manter o deep-link após o consumo.
  expect(new URL(page.url()).searchParams.get("abrir")).toBeNull();

  // Fecha para não vazar estado entre asserções.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

/** Abre o drawer de detalhe da primeira tarefa do quadro do projeto. */
async function abrirDrawerTarefa(page: Page) {
  if (TAREFA_ID) {
    await page.goto(`/dashboard/projetos/${PROJETO_ID}?tarefa=${TAREFA_ID}`);
  } else {
    await page.goto(`/dashboard/projetos/${PROJETO_ID}`);
    const card = page
      .locator('[data-testid="tarefa-card"], [data-tarefa-id]')
      .first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.click(); // clique único deve bastar
  }

  const drawer = page.getByRole("dialog").last();
  await expect(drawer).toBeVisible({ timeout: 20_000 });
  return drawer;
}

/** Garante que a aba/painel de chat da tarefa está visível. */
async function abrirChatDaTarefa(page: Page) {
  const abaChat = page
    .getByRole("tab", { name: /chat|conversa/i })
    .or(page.getByRole("button", { name: /chat|conversa/i }))
    .first();
  if (await abaChat.count()) {
    await abaChat.click().catch(() => undefined);
  }
  await expect(barraAcoes(page)).toBeVisible({ timeout: 20_000 });
}

test.describe("Chat — barra de ações e fluxo aprovação/atenção", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("hub de Chat: barra padrão + aprovação + chamar atenção", async ({
    page,
  }) => {
    await page.goto("/dashboard/chat");

    await test.step("Selecionar a primeira conversa de Pessoas", async () => {
      const conversa = page
        .locator('[data-testid="chat-conversa-item"], [data-conversa-id]')
        .first();
      if ((await conversa.count()) === 0) {
        test.skip(true, "Nenhuma conversa disponível para o usuário de teste");
      }
      await conversa.click();
    });

    await test.step("Barra padrão presente", async () => {
      await validarBarraPadrao(page, "hub");
      await attach(page, "hub-barra");
    });

    await test.step("Clique → diálogo de aprovação", async () => {
      await clicarEValidarResultado(page, "aprovacao", "hub");
    });

    await test.step("Clique → diálogo de chamar atenção", async () => {
      await clicarEValidarResultado(page, "urgente", "hub");
    });
  });

  test("painel lateral da tarefa: barra padrão + ações vinculadas", async ({
    page,
  }) => {
    test.skip(!PROJETO_ID, "E2E_PROJETO_ID não definido");

    await abrirDrawerTarefa(page);
    await abrirChatDaTarefa(page);

    await validarBarraPadrao(page, "painel-lateral");
    await attach(page, "painel-lateral-barra");

    await clicarEValidarResultado(page, "aprovacao", "painel-lateral");

    // A ação de aprovação navega para o hub; volta ao drawer para a 2ª ação.
    await abrirDrawerTarefa(page);
    await abrirChatDaTarefa(page);
    await clicarEValidarResultado(page, "urgente", "painel-lateral");
  });

  test("modo Foco: barra padrão + ações vinculadas", async ({ page }) => {
    test.skip(!PROJETO_ID, "E2E_PROJETO_ID não definido");

    await abrirDrawerTarefa(page);

    const btnFoco = page.getByRole("button", { name: /^foco$/i }).first();
    if ((await btnFoco.count()) === 0) {
      test.skip(true, "Usuário sem permissão de UI para o modo Foco");
    }
    await btnFoco.click();

    await abrirChatDaTarefa(page);
    await validarBarraPadrao(page, "modo-foco");
    await attach(page, "modo-foco-barra");

    await clicarEValidarResultado(page, "aprovacao", "modo-foco");

    await abrirDrawerTarefa(page);
    await page.getByRole("button", { name: /^foco$/i }).first().click();
    await abrirChatDaTarefa(page);
    await clicarEValidarResultado(page, "urgente", "modo-foco");
  });

  test("processos: barra padrão sem anexar/câmera + ações vinculadas", async ({
    page,
  }) => {
    test.skip(!PROCESSO_ID, "E2E_PROCESSO_ID não definido");

    await page.goto(`/dashboard/suporte/processos/${PROCESSO_ID}`);
    await abrirChatDaTarefa(page);

    await validarBarraPadrao(page, "processos");

    // Em Processos o anexo é feito pelo picker de documentos do processo:
    // a barra roda com showAttach/showCamera = false.
    await expect(
      page.getByRole("button", { name: "Anexar arquivo" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /anexar doc/i }).first(),
    ).toBeVisible();
    await attach(page, "processos-barra");

    await clicarEValidarResultado(page, "aprovacao", "processos");

    await page.goto(`/dashboard/suporte/processos/${PROCESSO_ID}`);
    await abrirChatDaTarefa(page);
    await clicarEValidarResultado(page, "urgente", "processos");
  });
});
