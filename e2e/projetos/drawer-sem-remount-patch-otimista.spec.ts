/**
 * E2E — Drawer de tarefa em Meus Projetos não remonta durante patch otimista.
 *
 * Regressão coberta:
 *   No caminho `/dashboard/projetos/:id?tarefa=:tarefaId`, editar campos do
 *   `ProjetoTarefaDetalhe` causava uma piscada visual porque a lista/quadro do
 *   projeto trocava para skeleton e desmontava o Sheet do detalhe.
 *
 * Este spec observa o DOM do drawer durante cada patch otimista e falha se o
 * drawer ou o grid de campos forem removidos/recriados.
 */

import { test, expect, type Page } from "@playwright/test";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BASE_URL = process.env.E2E_BASE_URL ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";
const SECAO_ID = process.env.E2E_SECAO_ID ?? "";
const OWNER = {
  email: process.env.E2E_OWNER_EMAIL ?? process.env.E2E_TEST_EMAIL ?? "",
  password: process.env.E2E_OWNER_PASSWORD ?? process.env.E2E_TEST_PASSWORD ?? "",
};

function newClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const c = newClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

async function loginUi(page: Page, email: string, password: string) {
  await page.goto("/auth");
  // IDs estáveis do LoginForm (#email/#password). getByLabel(/senha/i) viola o
  // strict mode: casa também com o botão aria-label="Mostrar senha".
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/(dashboard|projetos|central)/, { timeout: 30_000 });
}

async function armDrawerObserver(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __drawerStable?: {
        drawerRemoved: number;
        drawerAdded: number;
        fieldsRemoved: number;
        fieldsAdded: number;
        stop: () => void;
      };
    };
    w.__drawerStable?.stop?.();

    const state = {
      drawerRemoved: 0,
      drawerAdded: 0,
      fieldsRemoved: 0,
      fieldsAdded: 0,
      stop: () => obs.disconnect(),
    };

    const matches = (node: Node, selector: string) =>
      node.nodeType === 1 && (node as Element).matches(selector);
    const contains = (node: Node, selector: string) =>
      node.nodeType === 1 && !!(node as Element).querySelector(selector);

    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        m.removedNodes.forEach((node) => {
          if (matches(node, '[data-testid="projeto-tarefa-detalhe-drawer"]')) state.drawerRemoved++;
          if (contains(node, '[data-testid="projeto-tarefa-detalhe-drawer"]')) state.drawerRemoved++;
          if (matches(node, '[data-testid="projeto-tarefa-detalhe-fields"]')) state.fieldsRemoved++;
          if (contains(node, '[data-testid="projeto-tarefa-detalhe-fields"]')) state.fieldsRemoved++;
        });
        m.addedNodes.forEach((node) => {
          if (matches(node, '[data-testid="projeto-tarefa-detalhe-drawer"]')) state.drawerAdded++;
          if (contains(node, '[data-testid="projeto-tarefa-detalhe-drawer"]')) state.drawerAdded++;
          if (matches(node, '[data-testid="projeto-tarefa-detalhe-fields"]')) state.fieldsAdded++;
          if (contains(node, '[data-testid="projeto-tarefa-detalhe-fields"]')) state.fieldsAdded++;
        });
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
    w.__drawerStable = state;
  });
}

async function readDrawerObserver(page: Page) {
  return await page.evaluate(() => {
    const w = window as unknown as {
      __drawerStable?: {
        drawerRemoved: number;
        drawerAdded: number;
        fieldsRemoved: number;
        fieldsAdded: number;
      };
    };
    return {
      drawerRemoved: w.__drawerStable?.drawerRemoved ?? 0,
      drawerAdded: w.__drawerStable?.drawerAdded ?? 0,
      fieldsRemoved: w.__drawerStable?.fieldsRemoved ?? 0,
      fieldsAdded: w.__drawerStable?.fieldsAdded ?? 0,
    };
  });
}

async function expectNoDrawerRemount(page: Page, label: string, action: () => Promise<void>) {
  await armDrawerObserver(page);
  await action();
  await page.waitForTimeout(1200);
  const stats = await readDrawerObserver(page);
  expect(stats, `${label}: drawer/grid não deve desmontar durante patch otimista`).toEqual({
    drawerRemoved: 0,
    drawerAdded: 0,
    fieldsRemoved: 0,
    fieldsAdded: 0,
  });
}

async function chooseSelect(page: Page, triggerTestId: string, optionName: RegExp) {
  const trigger = page.getByTestId(triggerTestId);
  await trigger.waitFor({ timeout: 10_000 });
  await trigger.click();
  await page.getByRole("option", { name: optionName }).click();
}

test.describe("Meus Projetos — drawer sem remount em patch otimista", () => {
  test.skip(
    !BASE_URL || !SUPABASE_URL || !SUPABASE_KEY || !PROJETO_ID || !SECAO_ID,
    "E2E_BASE_URL / VITE_SUPABASE_* / E2E_PROJETO_ID / E2E_SECAO_ID obrigatórios",
  );
  test.skip(!OWNER.email || !OWNER.password, "E2E_OWNER_* obrigatório");

  let owner: SupabaseClient;
  let ownerUid = "";
  let tarefaId = "";
  const trash: string[] = [];

  test.beforeAll(async () => {
    owner = await signIn(OWNER.email, OWNER.password);
    ownerUid = (await owner.auth.getUser()).data.user?.id ?? "";
    expect(ownerUid).toBeTruthy();

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data, error } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e drawer-sem-remount] tarefa",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        responsavel_id: ownerUid,
        status: "pendente",
        prioridade: "media",
        estagio: "briefing",
        data_prazo: nextWeek,
        data_inicio_planejada: tomorrow,
        data_proxima_acao: tomorrow,
        dias_alerta_antes: 2,
      } as never)
      .select()
      .single();
    expect(error).toBeNull();
    tarefaId = data!.id;
    trash.push(tarefaId);
  });

  test.afterAll(async () => {
    if (trash.length) {
      await owner.from("projeto_tarefas_colaboradores").delete().in("tarefa_id", trash);
      await owner.from("projeto_tarefas_responsaveis").delete().in("tarefa_id", trash);
      await owner.from("projeto_tarefas").delete().in("id", trash);
    }
    await owner?.auth.signOut();
  });

  test("editar campos principais não desmonta o drawer", async ({ page }) => {
    await loginUi(page, OWNER.email, OWNER.password);
    await page.goto(`/dashboard/projetos/${PROJETO_ID}?tarefa=${tarefaId}`);
    await page.getByTestId("projeto-tarefa-detalhe-drawer").waitFor({ timeout: 20_000 });
    await page.getByTestId("projeto-tarefa-detalhe-fields").waitFor({ timeout: 20_000 });

    await expectNoDrawerRemount(page, "status", async () => {
      await chooseSelect(page, "tarefa-status-trigger", /em andamento/i);
    });

    await expectNoDrawerRemount(page, "prioridade", async () => {
      await chooseSelect(page, "tarefa-prioridade-trigger", /alta/i);
    });

    await expectNoDrawerRemount(page, "estágio", async () => {
      await chooseSelect(page, "tarefa-estagio-trigger", /revisão/i);
    });

    await expectNoDrawerRemount(page, "alertar antes", async () => {
      await chooseSelect(page, "tarefa-alertar-antes-trigger", /5 dias/i);
    });

    await expectNoDrawerRemount(page, "prazo", async () => {
      await page.getByTestId("tarefa-data-prazo-trigger").click();
      await page.getByTestId("clear-data-prazo").click();
    });

    await expectNoDrawerRemount(page, "próxima ação", async () => {
      await page.getByTestId("tarefa-data-proxima-acao-trigger").click();
      await page.getByTestId("clear-data-proxima-acao").click();
    });
  });
});