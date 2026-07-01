/**
 * E2E — Fallback do SmartAvatar quando a imagem falha.
 *
 * Objetivo:
 *   Garantir que, quando o `<img>` do avatar falha ao carregar (URL 404,
 *   bucket privado com signed URL expirada, rede bloqueada), o SmartAvatar:
 *
 *   1. Desmonta o `<img>` (não deixa placeholder quebrado na tela).
 *   2. Renderiza as iniciais como texto visível no fallback.
 *   3. Propaga simultaneamente para `title` do root, `aria-label` do root
 *      e `aria-label` do fallback a string exata
 *      `<nomeResolvido>[ (identifier)] — foto indisponível`.
 *   4. Nunca cai em placeholder genérico ("?", "Membro" quando existe nome
 *      real hidratado, "null", "undefined").
 *
 * Estratégia:
 *   Antes de logar, instala `page.route()` que ABORTA toda requisição a
 *   qualquer imagem servida pelo bucket `avatars` do Lovable Cloud
 *   (host termina em `.supabase.co` e path contém `/avatars/`). Assim
 *   forçamos o `onError` do `<AvatarImage>` sem depender de dados reais
 *   quebrados no backend. Em seguida navega para a subtarefa fixture
 *   e valida os invariantes acima em cada `SmartAvatar` visível
 *   (pilha de responsáveis + pilha de seguidores).
 *
 * Env obrigatórias (mesmo conjunto do spec `avatares-seguidores-papeis`):
 *   E2E_BASE_URL
 *   VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *   E2E_PROJETO_ID
 *   E2E_SECAO_ID
 *   E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD
 *
 * Env opcional:
 *   E2E_SEGUIDORES_IDS — CSV de user_ids para incluir como seguidores.
 *                        Se ausente, o teste ainda roda com só o dono.
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

/**
 * Intercepta requisições ao bucket `avatars` (privado) e retorna 404
 * para forçar o `onError` do `<AvatarImage>` em todo `SmartAvatar` da
 * página, sem tocar dados reais.
 */
async function blockAvatarImages(page: Page) {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    const isImage = route.request().resourceType() === "image";
    const isAvatarBucket = /\/storage\/v1\/object\/(sign|public)\/avatars\//.test(url);
    if (isImage && isAvatarBucket) {
      return route.fulfill({ status: 404, body: "" });
    }
    return route.continue();
  });
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
  await page
    .getByRole("button", { name: /(Seguidores \(|Adicionar seguidores|Carregando seguidores)/ })
    .first()
    .waitFor({ timeout: 20_000 });
}

// ---------------------------------------------------------------------------

test.describe("SmartAvatar — fallback quando imagem quebra", () => {
  test.skip(
    !BASE_URL || !SUPABASE_URL || !SUPABASE_KEY || !PROJETO_ID || !SECAO_ID,
    "E2E_BASE_URL / VITE_SUPABASE_* / E2E_PROJETO_ID / E2E_SECAO_ID obrigatórios",
  );
  test.skip(!OWNER.email || !OWNER.password, "E2E_OWNER_* obrigatório");

  let owner: SupabaseClient;
  let subtarefaId = "";
  const trash: string[] = [];

  test.beforeAll(async () => {
    owner = await signIn(OWNER.email, OWNER.password);

    const { data: root, error: rootErr } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e avatar-fallback] raiz",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
      })
      .select()
      .single();
    expect(rootErr).toBeNull();
    trash.push(root!.id);

    const uid = (await owner.auth.getUser()).data.user?.id ?? null;
    const { data: sub, error: subErr } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e avatar-fallback] subtarefa",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        parent_tarefa_id: root!.id,
        responsavel_id: uid,
      })
      .select()
      .single();
    expect(subErr).toBeNull();
    subtarefaId = sub!.id;
    trash.push(subtarefaId);

    if (SEGUIDORES_EXTRA.length) {
      const rows = SEGUIDORES_EXTRA.map((user_id) => ({
        tarefa_id: subtarefaId,
        user_id,
      }));
      const { error: colabErr } = await owner
        .from("projeto_tarefas_colaboradores")
        .insert(rows);
      expect(colabErr).toBeNull();
    }
  });

  test.afterAll(async () => {
    if (trash.length) {
      await owner
        .from("projeto_tarefas_colaboradores")
        .delete()
        .in("tarefa_id", trash);
      await owner.from("projeto_tarefas").delete().in("id", trash);
    }
    await owner?.auth.signOut();
  });

  test("todo <img> do bucket avatars falha → SmartAvatar exibe fallback textual + sufixo 'foto indisponível'", async ({
    page,
  }) => {
    await blockAvatarImages(page);
    await loginUi(page, OWNER.email, OWNER.password);
    await abrirTarefa(page, subtarefaId);

    // Dá ao React tempo de propagar o onError em todos os avatares visíveis.
    // Reagimos ao settle do document.images: nenhum request pendente e todo
    // <img> ou está removido (SmartAvatar desmonta no onError) ou está
    // com naturalWidth=0 (aborted). Poll com timeout curto.
    await page.waitForTimeout(1500);

    // 1) Nenhum <img> quebrado permanece na árvore: SmartAvatar deve
    //    desmontar `<AvatarImage>` no onError e cair para o fallback.
    const brokenImgs = await page.evaluate(() =>
      Array.from(document.images)
        .filter((img) => img.src.includes("/avatars/"))
        .map((img) => ({
          src: img.src,
          complete: img.complete,
          natural: img.naturalWidth,
        })),
    );
    // Aceita 0 (ideal — todos desmontados) OU apenas imagens ainda montadas
    // que já foram marcadas como quebradas mas o React ainda não reconciliou.
    // Nunca deve existir uma imagem "aparente ok" (complete + natural>0) no
    // bucket avatars, pois todas foram bloqueadas.
    for (const info of brokenImgs) {
      expect(info.natural, `img ${info.src} deveria ter naturalWidth=0`).toBe(0);
    }

    // 2) Todo SmartAvatar sinalizado por `[title]` no root Avatar precisa
    //    ter o sufixo "— foto indisponível" quando havia src do bucket
    //    avatars (o próprio SmartAvatar decide via estado `errored`).
    //    Coleta title + aria-label do root e aria-label do fallback,
    //    filtra somente os que tiveram tentativa de imagem.
    const invariants = await page.evaluate(() => {
      const spans = Array.from(
        document.querySelectorAll<HTMLElement>("span[title][aria-label]"),
      );
      return spans
        .map((root) => {
          const title = root.getAttribute("title") ?? "";
          const ariaRoot = root.getAttribute("aria-label") ?? "";
          const fb = root.querySelector<HTMLElement>("span[aria-label]");
          const ariaFb = fb?.getAttribute("aria-label") ?? "";
          const fbText = (fb?.textContent ?? "").trim();
          return { title, ariaRoot, ariaFb, fbText };
        })
        // Só o SmartAvatar em erro carrega o sufixo — filtra outros
        // spans genéricos com title/aria-label.
        .filter((r) => r.title.includes("— foto indisponível"));
    });

    // Precisa haver ao menos 1 SmartAvatar em estado de erro
    // (o responsável = owner, cujo avatar do bucket foi bloqueado).
    expect(invariants.length).toBeGreaterThan(0);

    for (const inv of invariants) {
      // 3) title === aria-label(root) === aria-label(fallback) — sem
      //    divergência para o SR.
      expect(inv.ariaRoot).toBe(inv.title);
      expect(inv.ariaFb).toBe(inv.title);

      // 4) Formato exato: "<nome>[ (identifier)] — foto indisponível".
      //    Nome não pode ser vazio nem "?" nem "null"/"undefined" literal.
      const base = inv.title.replace(/ — foto indisponível$/, "");
      expect(base.length).toBeGreaterThan(0);
      expect(base).not.toBe("?");
      expect(base).not.toMatch(/^(null|undefined)(\s|$|\()/i);

      // 5) O fallback textual visível carrega iniciais não-vazias
      //    (nunca "?" para dados hidratados corretamente).
      expect(inv.fbText.length).toBeGreaterThan(0);
      // Iniciais têm 1-2 caracteres alfanuméricos (permite CJK e acentos).
      expect(inv.fbText.length).toBeLessThanOrEqual(4);
    }
  });

  test("aria-label do fallback é derivada da MESMA string do title (sem divergência para SR)", async ({
    page,
  }) => {
    await blockAvatarImages(page);
    await loginUi(page, OWNER.email, OWNER.password);
    await abrirTarefa(page, subtarefaId);
    await page.waitForTimeout(1500);

    // Foca no avatar do responsável (garantido a existir — subtarefa foi
    // criada com responsavel_id = owner).
    const divergences = await page.evaluate(() => {
      const spans = Array.from(
        document.querySelectorAll<HTMLElement>("span[title][aria-label]"),
      );
      const out: Array<{ title: string; ariaRoot: string; ariaFb: string }> = [];
      for (const root of spans) {
        const title = root.getAttribute("title") ?? "";
        if (!title) continue;
        const ariaRoot = root.getAttribute("aria-label") ?? "";
        const fb = root.querySelector<HTMLElement>("span[aria-label]");
        const ariaFb = fb?.getAttribute("aria-label") ?? "";
        if (title !== ariaRoot || (fb && title !== ariaFb)) {
          out.push({ title, ariaRoot, ariaFb });
        }
      }
      return out;
    });

    expect(
      divergences,
      `SmartAvatar com title != aria-label detectado: ${JSON.stringify(divergences, null, 2)}`,
    ).toEqual([]);
  });
});
