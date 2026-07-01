/**
 * E2E — Criar subtarefa dentro da subtarefa (web) + permissões creator/assignee.
 *
 * Cobertura:
 *  1. Backend/permissões (RLS pós-migração):
 *     a) CRIADOR (criador_id = auth.uid()) que NÃO é membro do projeto
 *        consegue inserir subtarefa de subtarefa em sua própria tarefa.
 *     b) RESPONSÁVEL (responsavel_id = auth.uid()) que NÃO é membro do projeto
 *        consegue inserir subtarefa de subtarefa em tarefa atribuída a ele.
 *     c) OUTSIDER (nem criador, nem responsável, nem membro) NÃO consegue
 *        inserir subtarefa filha nem enxergar a árvore.
 *  2. UI/web (sem F5): abrir tarefa no drawer, criar nível 3 via
 *     "+ Adicionar subitem" e verificar que o novo nó aparece na árvore
 *     sem recarregar a página (invalidação de cache/optimistic update).
 *
 * Variáveis de ambiente:
 *   E2E_BASE_URL
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD           membro do projeto (owner do teste)
 *   E2E_PROJETO_ID / E2E_SECAO_ID
 *   E2E_CREATOR_EMAIL / E2E_CREATOR_PASSWORD     usuário NÃO-membro (criador da tarefa)
 *   E2E_ASSIGNEE_EMAIL / E2E_ASSIGNEE_PASSWORD   usuário NÃO-membro (responsável)
 *   E2E_ASSIGNEE_USER_ID                         auth.uid() do responsável
 *   E2E_OUTSIDER_EMAIL / E2E_OUTSIDER_PASSWORD   usuário sem qualquer vínculo
 *   VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Se as credenciais opcionais faltarem, os testes correspondentes são
 * pulados com `test.skip` — não falham o pipeline.
 */
import { test, expect, type Page } from "@playwright/test";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";
const SECAO_ID = process.env.E2E_SECAO_ID ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

function newClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Supabase env vars ausentes");
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email?: string, password?: string): Promise<SupabaseClient> {
  if (!email || !password) throw new Error("Credenciais ausentes");
  const c = newClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

async function loginUi(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

// ---------------------------------------------------------------------------
// 1. Backend — permissões creator / assignee / outsider
// ---------------------------------------------------------------------------
test.describe("Sub-subtarefa — permissões (criador vs responsável vs outsider)", () => {
  let owner: SupabaseClient;
  const trash: string[] = [];

  test.beforeAll(async () => {
    owner = await signIn(process.env.E2E_TEST_EMAIL, process.env.E2E_TEST_PASSWORD);
  });

  test.afterAll(async () => {
    if (trash.length) await owner.from("projeto_tarefas").delete().in("id", trash);
    await owner?.auth.signOut();
  });

  test("CRIADOR (não-membro) cria subtarefa de subtarefa em tarefa própria", async () => {
    test.skip(
      !process.env.E2E_CREATOR_EMAIL || !process.env.E2E_CREATOR_PASSWORD,
      "E2E_CREATOR_* não configurado",
    );
    const creator = await signIn(process.env.E2E_CREATOR_EMAIL, process.env.E2E_CREATOR_PASSWORD);
    const { data: authData } = await creator.auth.getUser();
    const creatorId = authData.user?.id;
    expect(creatorId).toBeTruthy();

    // Owner cria a tarefa raiz mas define criador_id = creatorId.
    const { data: root, error: rootErr } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e perm] root-creator",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        criador_id: creatorId,
      })
      .select()
      .single();
    expect(rootErr).toBeNull();
    trash.push(root!.id);

    // N2 também de propriedade do creator.
    const { data: n2, error: n2Err } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e perm] n2-creator",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: root!.id,
        criador_id: creatorId,
      })
      .select()
      .single();
    expect(n2Err).toBeNull();
    trash.push(n2!.id);

    // Creator (NÃO-membro) tenta criar N3 sob N2 → deve passar (policy criador_id).
    const { data: n3, error: n3Err } = await creator
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e perm] n3-by-creator",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: n2!.id,
      })
      .select()
      .single();
    expect(n3Err).toBeNull();
    expect(n3?.parent_tarefa_id).toBe(n2!.id);
    if (n3?.id) trash.push(n3.id);

    await creator.auth.signOut();
  });

  test("RESPONSÁVEL (não-membro) cria subtarefa de subtarefa em tarefa atribuída", async () => {
    test.skip(
      !process.env.E2E_ASSIGNEE_EMAIL ||
        !process.env.E2E_ASSIGNEE_PASSWORD ||
        !process.env.E2E_ASSIGNEE_USER_ID,
      "E2E_ASSIGNEE_* não configurado",
    );
    const assigneeId = process.env.E2E_ASSIGNEE_USER_ID!;

    const { data: root } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e perm] root-assignee",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        responsavel_id: assigneeId,
      })
      .select()
      .single();
    trash.push(root!.id);

    const { data: n2 } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e perm] n2-assignee",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: root!.id,
        responsavel_id: assigneeId,
      })
      .select()
      .single();
    trash.push(n2!.id);

    const assignee = await signIn(process.env.E2E_ASSIGNEE_EMAIL, process.env.E2E_ASSIGNEE_PASSWORD);
    const { data: n3, error: n3Err } = await assignee
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e perm] n3-by-assignee",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: n2!.id,
      })
      .select()
      .single();
    expect(n3Err).toBeNull();
    expect(n3?.parent_tarefa_id).toBe(n2!.id);
    if (n3?.id) trash.push(n3.id);
    await assignee.auth.signOut();
  });

  test("OUTSIDER não pode criar sub-subtarefa nem enxergar a árvore", async () => {
    test.skip(
      !process.env.E2E_OUTSIDER_EMAIL || !process.env.E2E_OUTSIDER_PASSWORD,
      "E2E_OUTSIDER_* não configurado",
    );
    const { data: root } = await owner
      .from("projeto_tarefas")
      .insert({ titulo: "[e2e perm] root-outsider", projeto_id: PROJETO_ID, secao_id: SECAO_ID })
      .select()
      .single();
    const { data: n2 } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e perm] n2-outsider",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: root!.id,
      })
      .select()
      .single();
    trash.push(root!.id, n2!.id);

    const outsider = await signIn(process.env.E2E_OUTSIDER_EMAIL, process.env.E2E_OUTSIDER_PASSWORD);

    // Nem SELECT deve retornar a árvore.
    const { data: leaked } = await outsider
      .from("projeto_tarefas")
      .select("id")
      .in("id", [root!.id, n2!.id]);
    expect(leaked ?? []).toHaveLength(0);

    // INSERT como filho da N2 deve falhar (RLS) — retorna erro ou zero linhas.
    const { data: attempt, error } = await outsider
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e perm] hacked-n3",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: n2!.id,
      })
      .select();
    expect(error !== null || (attempt ?? []).length === 0).toBe(true);
    if (attempt && attempt[0]?.id) trash.push(attempt[0].id);
    await outsider.auth.signOut();
  });
});

// ---------------------------------------------------------------------------
// 2. UI web — criar N3 sem exigir F5
// ---------------------------------------------------------------------------
test.describe("Sub-subtarefa — UI web sem F5", () => {
  let sb: SupabaseClient;
  const trash: string[] = [];

  test.beforeAll(async () => {
    sb = await signIn(process.env.E2E_TEST_EMAIL, process.env.E2E_TEST_PASSWORD);
  });
  test.afterAll(async () => {
    if (trash.length) await sb.from("projeto_tarefas").delete().in("id", trash);
    await sb?.auth.signOut();
  });

  test("clicar em '+ Adicionar subitem' na N2 cria N3 e ele aparece na árvore sem reload", async ({ page }) => {
    test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, "Credenciais ausentes");
    test.skip(!PROJETO_ID || !SECAO_ID, "E2E_PROJETO_ID / E2E_SECAO_ID ausentes");

    // Semeia N1 → N2 no projeto para termos alvo estável no drawer.
    const stamp = Date.now();
    const { data: n1 } = await sb
      .from("projeto_tarefas")
      .insert({ titulo: `[e2e ui] root ${stamp}`, projeto_id: PROJETO_ID, secao_id: SECAO_ID })
      .select()
      .single();
    const { data: n2 } = await sb
      .from("projeto_tarefas")
      .insert({
        titulo: `[e2e ui] child ${stamp}`,
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: n1!.id,
      })
      .select()
      .single();
    trash.push(n1!.id, n2!.id);

    await loginUi(page, process.env.E2E_TEST_EMAIL!, process.env.E2E_TEST_PASSWORD!);
    await page.goto(`/dashboard/projetos/${PROJETO_ID}?tarefa=${n1!.id}`);

    // Botão de adicionar subitem SOB a N2 (subtarefa dentro da subtarefa).
    const addBtn = page.locator(`[data-testid="subitem-add-${n2!.id}"]`);
    await expect(addBtn).toBeVisible({ timeout: 20_000 });
    await addBtn.click();

    const input = page.locator(`[data-testid="subitem-input-${n2!.id}"]`);
    await expect(input).toBeVisible();
    const titulo = `[e2e ui] n3 sem F5 ${stamp}`;
    await input.fill(titulo);
    await input.press("Enter");

    // Sem F5: o novo nó deve aparecer na árvore via cache invalidation.
    await expect(page.getByText(titulo, { exact: false })).toBeVisible({ timeout: 15_000 });

    // Confirma persistência real e captura id para limpeza.
    const { data: created } = await sb
      .from("projeto_tarefas")
      .select("id, parent_tarefa_id, titulo")
      .eq("parent_tarefa_id", n2!.id)
      .eq("titulo", titulo)
      .maybeSingle();
    expect(created?.parent_tarefa_id).toBe(n2!.id);
    if (created?.id) trash.push(created.id);

    // Não deve ter havido navigation/reload após o Enter (sanity check).
    expect(page.url()).toContain(`tarefa=${n1!.id}`);
  });
});
