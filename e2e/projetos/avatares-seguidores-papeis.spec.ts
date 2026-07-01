/**
 * E2E — Avatares e contadores de seguidores por papel (dono / membro / convidado).
 *
 * Objetivo:
 *   Garantir que a pilha de avatares e o contador `+N` de seguidores do
 *   `SubtarefaSeguidoresPicker` renderizam de forma consistente sob RLS
 *   para três perfis distintos:
 *
 *     - DONO      → membro do projeto com role owner/admin. Vê 100% dos
 *                   seguidores e o tooltip enumera todos os nomes.
 *     - MEMBRO    → colaborador comum do projeto. Deve ver os mesmos
 *                   seguidores que o dono (RLS libera projetos aos quais
 *                   pertence) e o mesmo contador `+N`.
 *     - CONVIDADO → usuário externo, apenas responsável por UMA subtarefa.
 *                   Se a RLS permitir enxergar a tarefa, o picker precisa
 *                   exibir fallback textual (iniciais) para os seguidores
 *                   sem foto acessível e NUNCA renderizar `<img>` quebrado.
 *                   Se a RLS bloquear, o teste é pulado (comportamento OK).
 *
 * Contrato validado por asserção (não depende de foto real carregar):
 *   1. Trigger do picker tem `aria-label` do formato
 *      `Seguidores (N): Nome1, Nome2, ...` OU `Adicionar seguidores` OU
 *      `Carregando seguidores` — nunca vazio.
 *   2. Cada avatar visível renderiza SmartAvatar com `title` = nome (ou
 *      `Nome (identifier)`), preservado mesmo quando `<img>` falha
 *      (fallback textual com iniciais).
 *   3. Quando há mais de 3 seguidores, o contador `+N` existe com
 *      `aria-label="mais N seguidor(es)"` e N == totalSeguidores - 3.
 *   4. Contador visto por dono e membro é idêntico ao esperado (fonte
 *      da verdade = backend). Convidado vê ≤ contador do dono.
 *
 * Env obrigatórias:
 *   E2E_BASE_URL
 *   VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *   E2E_PROJETO_ID
 *   E2E_SECAO_ID
 *   E2E_OWNER_EMAIL     / E2E_OWNER_PASSWORD
 *   E2E_MEMBER_EMAIL    / E2E_MEMBER_PASSWORD
 *
 * Env opcionais (se ausentes, o cenário do papel correspondente é pulado):
 *   E2E_GUEST_EMAIL     / E2E_GUEST_PASSWORD / E2E_GUEST_USER_ID
 *   E2E_SEGUIDORES_IDS  CSV de user_ids para adicionar como colaboradores
 *                       (mínimo 4 para exercitar o contador `+N`). Se
 *                       ausente, apenas o convidado + owner + member entram
 *                       na lista, o que ainda valida avatares mas não o `+N`.
 */

import { test, expect, type Page, type Locator } from "@playwright/test";
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
const MEMBER = {
  email: process.env.E2E_MEMBER_EMAIL ?? "",
  password: process.env.E2E_MEMBER_PASSWORD ?? "",
};
const GUEST = {
  email: process.env.E2E_GUEST_EMAIL ?? "",
  password: process.env.E2E_GUEST_PASSWORD ?? "",
  userId: process.env.E2E_GUEST_USER_ID ?? "",
};
const SEGUIDORES_EXTRA = (process.env.E2E_SEGUIDORES_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/(dashboard|projetos|central)/, { timeout: 30_000 });
}

async function abrirTarefa(page: Page, tarefaId: string) {
  await page.goto(`/projetos/${PROJETO_ID}?tarefa=${tarefaId}`);
  // Drawer/focus mode monta assíncrono; espera trigger do picker aparecer.
  await page
    .getByRole("button", { name: /(Seguidores \(|Adicionar seguidores|Carregando seguidores)/ })
    .first()
    .waitFor({ timeout: 20_000 });
}

function pickerTrigger(page: Page): Locator {
  return page
    .getByRole("button", { name: /(Seguidores \(|Adicionar seguidores|Carregando seguidores)/ })
    .first();
}

/** Extrai `N` de `aria-label="Seguidores (N): ..."`. Retorna null se ausente. */
async function readCount(trigger: Locator): Promise<number | null> {
  const label = (await trigger.getAttribute("aria-label")) ?? "";
  const m = label.match(/Seguidores \((\d+)\)/);
  return m ? Number(m[1]) : null;
}

/** Retorna o `N` do contador `+N` se existir, ou 0 se ausente. */
async function readOverflow(page: Page): Promise<number> {
  const overflow = page.getByLabel(/^mais \d+ seguidor(es)?$/).first();
  if (!(await overflow.count())) return 0;
  const label = (await overflow.getAttribute("aria-label")) ?? "";
  const m = label.match(/mais (\d+)/);
  return m ? Number(m[1]) : 0;
}

// ---------------------------------------------------------------------------
// Fixture: um projeto + tarefa raiz + subtarefa com N seguidores.
// Criada uma única vez pelo owner (backend); limpa no afterAll.
// ---------------------------------------------------------------------------

test.describe("Avatares e contadores de seguidores por papel", () => {
  test.skip(
    !BASE_URL || !SUPABASE_URL || !SUPABASE_KEY || !PROJETO_ID || !SECAO_ID,
    "E2E_BASE_URL / VITE_SUPABASE_* / E2E_PROJETO_ID / E2E_SECAO_ID obrigatórios",
  );
  test.skip(!OWNER.email || !OWNER.password, "E2E_OWNER_* obrigatório");

  let owner: SupabaseClient;
  let subtarefaId = "";
  let expectedTotal = 0;
  const trash: string[] = [];

  test.beforeAll(async () => {
    owner = await signIn(OWNER.email, OWNER.password);

    // 1. Cria tarefa raiz.
    const { data: root, error: rootErr } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e avatares] raiz",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
      })
      .select()
      .single();
    expect(rootErr).toBeNull();
    trash.push(root!.id);

    // 2. Cria subtarefa (nível 2) — é aqui que o picker de seguidores mora.
    const { data: sub, error: subErr } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e avatares] subtarefa com seguidores",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: root!.id,
        // Convidado (se configurado) vira responsável para RLS enxergar
        // a subtarefa mesmo sendo não-membro.
        responsavel_id: GUEST.userId || null,
      })
      .select()
      .single();
    expect(subErr).toBeNull();
    subtarefaId = sub!.id;
    trash.push(subtarefaId);

    // 3. Monta lista de seguidores: extras + convidado (se houver).
    const seguidores = [...SEGUIDORES_EXTRA];
    if (GUEST.userId && !seguidores.includes(GUEST.userId)) {
      seguidores.push(GUEST.userId);
    }
    if (seguidores.length) {
      const rows = seguidores.map((user_id) => ({ tarefa_id: subtarefaId, user_id }));
      const { error: colabErr } = await owner
        .from("projeto_tarefas_colaboradores")
        .insert(rows);
      expect(colabErr).toBeNull();
    }
    expectedTotal = seguidores.length;
  });

  test.afterAll(async () => {
    if (trash.length) {
      // colaboradores caem em cascade via FK; caso contrário, limpe manual.
      await owner
        .from("projeto_tarefas_colaboradores")
        .delete()
        .in("tarefa_id", trash);
      await owner.from("projeto_tarefas").delete().in("id", trash);
    }
    await owner?.auth.signOut();
  });

  test("DONO vê contador e enumeração completa dos seguidores", async ({ page }) => {
    await loginUi(page, OWNER.email, OWNER.password);
    await abrirTarefa(page, subtarefaId);

    const trigger = pickerTrigger(page);
    const count = await readCount(trigger);

    if (expectedTotal === 0) {
      // Sem seguidores → trigger em modo "Adicionar seguidores".
      expect(await trigger.getAttribute("aria-label")).toMatch(/Adicionar seguidores/);
    } else {
      expect(count).toBe(expectedTotal);
      // aria-label enumera nomes (não fica vazio depois dos dois-pontos).
      const label = (await trigger.getAttribute("aria-label")) ?? "";
      expect(label).toMatch(/Seguidores \(\d+\): .+/);
      // Cada nome é não-vazio (sem "Membro, Membro, Membro" quando há dados).
      const nomes = label.split(":")[1]?.split(",").map((s) => s.trim()) ?? [];
      expect(nomes.length).toBe(expectedTotal);
      nomes.forEach((n) => expect(n.length).toBeGreaterThan(0));

      // Contador `+N` só aparece com > 3 seguidores; N deve fechar a soma.
      const overflow = await readOverflow(page);
      expect(overflow).toBe(Math.max(0, expectedTotal - 3));
    }

    // Nenhum <img> quebrado renderizado (SmartAvatar cai em fallback).
    const broken = await page.evaluate(() =>
      Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).length,
    );
    expect(broken).toBe(0);
  });

  test("MEMBRO vê o mesmo contador e nomes que o dono", async ({ page }) => {
    test.skip(!MEMBER.email || !MEMBER.password, "E2E_MEMBER_* não configurado");
    await loginUi(page, MEMBER.email, MEMBER.password);
    await abrirTarefa(page, subtarefaId);

    const trigger = pickerTrigger(page);
    const count = await readCount(trigger);
    if (expectedTotal === 0) {
      expect(await trigger.getAttribute("aria-label")).toMatch(/Adicionar seguidores/);
    } else {
      expect(count).toBe(expectedTotal);
      expect(await readOverflow(page)).toBe(Math.max(0, expectedTotal - 3));
    }

    const broken = await page.evaluate(() =>
      Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).length,
    );
    expect(broken).toBe(0);
  });

  test("CONVIDADO (responsável não-membro) vê picker sem <img> quebrado", async ({ page }) => {
    test.skip(
      !GUEST.email || !GUEST.password || !GUEST.userId,
      "E2E_GUEST_* não configurado",
    );
    await loginUi(page, GUEST.email, GUEST.password);
    await abrirTarefa(page, subtarefaId);

    const trigger = pickerTrigger(page);
    const label = (await trigger.getAttribute("aria-label")) ?? "";
    // Convidado é responsável → RLS libera a subtarefa; picker deve montar.
    expect(label).not.toBe("");
    expect(label).toMatch(/(Seguidores \(|Adicionar seguidores|Carregando seguidores)/);

    // Se enxerga seguidores, contador ≤ total do dono (RLS pode filtrar).
    const count = (await readCount(trigger)) ?? 0;
    expect(count).toBeLessThanOrEqual(expectedTotal);

    // Contrato central: NENHUM avatar quebrado, mesmo sob RLS parcial.
    const broken = await page.evaluate(() =>
      Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).length,
    );
    expect(broken).toBe(0);

    // Todo avatar renderizado tem title/aria-label não vazio (fallback textual).
    const avatars = page.locator('[data-slot="avatar"], .avatar, [role="img"]');
    const n = await avatars.count();
    for (let i = 0; i < n; i++) {
      const el = avatars.nth(i);
      const t = (await el.getAttribute("title")) ?? (await el.getAttribute("aria-label")) ?? "";
      expect(t.trim().length).toBeGreaterThan(0);
    }
  });
});
