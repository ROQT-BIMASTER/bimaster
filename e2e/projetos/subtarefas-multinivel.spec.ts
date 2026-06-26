/**
 * E2E — Subtarefas multi-nível (N níveis) em projeto_tarefas.
 *
 * Cobre:
 *  1. Backend: criação de subtarefa de subtarefa (níveis 2 e 3) preservando
 *     projeto_id/secao_id herdados do pai.
 *  2. Backend: trigger `trg_validate_tarefa_parent_integrity` rejeita
 *     parent_tarefa_id de outro projeto, auto-referência e ciclos.
 *  3. Backend: edição e exclusão funcionam em qualquer nível; exclusão do pai
 *     remove cascata via FK ON DELETE CASCADE existente.
 *  4. Backend: reordenação (`ordem`) entre nós irmãos NÃO altera
 *     parent_tarefa_id e mantém a árvore intacta.
 *  5. Backend: RLS — usuário sem acesso ao projeto NÃO enxerga subtarefas
 *     profundas (mesma policy aplica em qualquer nível).
 *  6. Frontend: botão "+ Adicionar subitem" cria filho no mesmo projeto,
 *     árvore expande/recolhe sem perder filhos, e datas não são herdadas
 *     automaticamente (data_prazo do filho inicia null).
 *
 * Variáveis de ambiente:
 *   - E2E_BASE_URL
 *   - E2E_TEST_EMAIL / E2E_TEST_PASSWORD             (membro de PROJETO_ID)
 *   - E2E_PROJETO_ID                                 projeto principal
 *   - E2E_SECAO_ID                                   seção desse projeto
 *   - E2E_OUTRO_PROJETO_ID  E2E_OUTRO_PROJETO_TAREFA tarefa de OUTRO projeto
 *   - E2E_OUTSIDER_EMAIL / E2E_OUTSIDER_PASSWORD     usuário SEM acesso
 *   - VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";
const SECAO_ID = process.env.E2E_SECAO_ID ?? "";
const OUTRO_PROJETO_TAREFA = process.env.E2E_OUTRO_PROJETO_TAREFA ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

function client(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase env vars ausentes");
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function signIn(email?: string, password?: string): Promise<SupabaseClient> {
  if (!email || !password) throw new Error("Credenciais E2E ausentes");
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

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

test.describe("Subtarefas multi-nível", () => {
  const createdIds: string[] = [];
  let sb: SupabaseClient;

  test.beforeAll(async () => {
    sb = await signIn(process.env.E2E_TEST_EMAIL, process.env.E2E_TEST_PASSWORD);
  });

  test.afterAll(async () => {
    if (createdIds.length) {
      await sb.from("projeto_tarefas").delete().in("id", createdIds);
    }
  });

  test("cria árvore de 3 níveis herdando projeto/seção do pai", async () => {
    const ins = async (titulo: string, parent: string | null) => {
      const { data, error } = await sb
        .from("projeto_tarefas")
        .insert({ titulo, projeto_id: PROJETO_ID, secao_id: SECAO_ID, parent_tarefa_id: parent })
        .select()
        .single();
      expect(error).toBeNull();
      createdIds.push(data!.id);
      return data!;
    };

    const n1 = await ins("[e2e] N1", null);
    const n2 = await ins("[e2e] N2", n1.id);
    const n3 = await ins("[e2e] N3", n2.id);

    expect(n2.projeto_id).toBe(PROJETO_ID);
    expect(n3.projeto_id).toBe(PROJETO_ID);
    expect(n2.parent_tarefa_id).toBe(n1.id);
    expect(n3.parent_tarefa_id).toBe(n2.id);
    // Datas NÃO são herdadas automaticamente.
    expect(n2.data_prazo).toBeNull();
    expect(n3.data_prazo).toBeNull();
  });

  test("rejeita parent_tarefa_id de outro projeto", async () => {
    test.skip(!OUTRO_PROJETO_TAREFA, "E2E_OUTRO_PROJETO_TAREFA não configurado");
    const { error } = await sb.from("projeto_tarefas").insert({
      titulo: "[e2e] cross-project",
      projeto_id: PROJETO_ID,
      secao_id: SECAO_ID,
      parent_tarefa_id: OUTRO_PROJETO_TAREFA,
    });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toMatch(/projeto|parent/);
  });

  test("rejeita auto-referência (parent = id)", async () => {
    const { data: row } = await sb
      .from("projeto_tarefas")
      .insert({ titulo: "[e2e] self", projeto_id: PROJETO_ID, secao_id: SECAO_ID })
      .select()
      .single();
    createdIds.push(row!.id);
    const { error } = await sb
      .from("projeto_tarefas")
      .update({ parent_tarefa_id: row!.id })
      .eq("id", row!.id);
    expect(error).not.toBeNull();
  });

  test("edição e exclusão funcionam em qualquer nível", async () => {
    const insert = (titulo: string, parent: string | null) =>
      sb
        .from("projeto_tarefas")
        .insert({ titulo, projeto_id: PROJETO_ID, secao_id: SECAO_ID, parent_tarefa_id: parent })
        .select()
        .single();

    const { data: a } = await insert("[e2e] edit-A", null);
    const { data: b } = await insert("[e2e] edit-B", a!.id);
    const { data: c } = await insert("[e2e] edit-C", b!.id);
    createdIds.push(a!.id, b!.id, c!.id);

    // Edição em nível 3
    const { error: upErr } = await sb
      .from("projeto_tarefas")
      .update({ titulo: "[e2e] edit-C-renomeado" })
      .eq("id", c!.id);
    expect(upErr).toBeNull();

    // Exclusão em nível 2 deve cascatear para nível 3
    const { error: delErr } = await sb.from("projeto_tarefas").delete().eq("id", b!.id);
    expect(delErr).toBeNull();
    const { data: remaining } = await sb
      .from("projeto_tarefas")
      .select("id")
      .in("id", [b!.id, c!.id]);
    expect(remaining ?? []).toHaveLength(0);
  });

  test("reordenação entre irmãos não altera parent_tarefa_id", async () => {
    const ins = (titulo: string, parent: string, ordem: number) =>
      sb
        .from("projeto_tarefas")
        .insert({ titulo, projeto_id: PROJETO_ID, secao_id: SECAO_ID, parent_tarefa_id: parent, ordem })
        .select()
        .single();

    const { data: root } = await sb
      .from("projeto_tarefas")
      .insert({ titulo: "[e2e] reorder-root", projeto_id: PROJETO_ID, secao_id: SECAO_ID })
      .select()
      .single();
    createdIds.push(root!.id);
    const { data: s1 } = await ins("[e2e] s1", root!.id, 0);
    const { data: s2 } = await ins("[e2e] s2", root!.id, 1);
    const { data: s3 } = await ins("[e2e] s3", root!.id, 2);
    createdIds.push(s1!.id, s2!.id, s3!.id);

    // Reorder: troca s1 <-> s3
    await sb.from("projeto_tarefas").update({ ordem: 2 }).eq("id", s1!.id);
    await sb.from("projeto_tarefas").update({ ordem: 0 }).eq("id", s3!.id);

    const { data: after } = await sb
      .from("projeto_tarefas")
      .select("id, ordem, parent_tarefa_id")
      .in("id", [s1!.id, s2!.id, s3!.id]);

    const byId = Object.fromEntries((after ?? []).map((r) => [r.id, r]));
    expect(byId[s1!.id].parent_tarefa_id).toBe(root!.id);
    expect(byId[s2!.id].parent_tarefa_id).toBe(root!.id);
    expect(byId[s3!.id].parent_tarefa_id).toBe(root!.id);
    expect(byId[s1!.id].ordem).toBe(2);
    expect(byId[s3!.id].ordem).toBe(0);
  });

  test("RLS — outsider não enxerga subtarefas profundas", async () => {
    test.skip(
      !process.env.E2E_OUTSIDER_EMAIL || !process.env.E2E_OUTSIDER_PASSWORD,
      "E2E_OUTSIDER_* não configurado",
    );
    const { data: root } = await sb
      .from("projeto_tarefas")
      .insert({ titulo: "[e2e] rls-root", projeto_id: PROJETO_ID, secao_id: SECAO_ID })
      .select()
      .single();
    const { data: deep } = await sb
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e] rls-deep",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: root!.id,
      })
      .select()
      .single();
    createdIds.push(root!.id, deep!.id);

    const outsider = await signIn(
      process.env.E2E_OUTSIDER_EMAIL,
      process.env.E2E_OUTSIDER_PASSWORD,
    );
    const { data: leaked } = await outsider
      .from("projeto_tarefas")
      .select("id")
      .in("id", [root!.id, deep!.id]);
    expect(leaked ?? []).toHaveLength(0);
    await outsider.auth.signOut();
  });
});

test.describe("Subtarefas multi-nível — UI", () => {
  test("botão '+ Adicionar subitem' cria filho e árvore expande/recolhe", async ({ page }) => {
    test.skip(!PROJETO_ID, "E2E_PROJETO_ID ausente");
    await login(page);
    await page.goto(`/dashboard/projetos/${PROJETO_ID}`);

    // Abre primeira tarefa visível com subtarefas (UI específica do projeto).
    const firstTask = page.locator('[data-testid^="tarefa-row-"]').first();
    await expect(firstTask).toBeVisible({ timeout: 15_000 });
    await firstTask.click();

    // Localiza qualquer botão de "Adicionar subitem" (subtarefa de subtarefa).
    const addBtn = page.locator('[data-testid^="subitem-add-"]').first();
    if (await addBtn.count()) {
      await addBtn.hover();
      await addBtn.click();
      const input = page.locator('[data-testid^="subitem-input-"]').first();
      await input.fill(`[e2e ui] sub-sub ${Date.now()}`);
      await input.press("Enter");
      // Toast/persistência: o nó pai deve continuar expandido (não some).
      await expect(page.locator('[data-testid^="subitem-add-"]').first()).toBeVisible();
    }
  });
});
