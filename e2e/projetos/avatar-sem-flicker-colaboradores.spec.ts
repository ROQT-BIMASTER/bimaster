/**
 * E2E — Avatares NÃO piscam ao adicionar/remover COLABORADORES (seguidores)
 * no drawer de tarefa em Meus Projetos, usando patch otimista.
 *
 * Escopo (regressão específica):
 *   Foca exclusivamente no editor de SEGUIDORES do `ProjetoTarefaDetalhe`
 *   (`TarefaResponsavelSeguidoresEditor`). Complementa o spec mais amplo
 *   `avatar-sem-flicker-otimista.spec.ts` (que cobre também responsáveis),
 *   garantindo que qualquer regressão isolada em colaboradores seja detectada
 *   por um teste dedicado no CI.
 *
 * O que valida:
 *   1. Add colaborador → nenhum `<img data-slot="avatar-image">` pré-existente
 *      é desmontado durante a janela do patch otimista.
 *   2. Add colaborador → nenhum `[data-slot="avatar-fallback"]` textual
 *      "brilha" (aparece transitoriamente) em outros avatares já montados.
 *   3. Remove colaborador → mesma asserção (tolerando 1 remoção: a do próprio
 *      avatar que sai da pill).
 *
 * Estratégia idêntica à do spec de responsáveis:
 *   - MutationObserver com baseline de `src` de `<img>` avatar já montados.
 *   - Só conta como flicker a remoção de um `src` que existia ANTES da ação.
 *   - Fora da janela armada, nada é contado (popover fechando não polui).
 *
 * Env obrigatórias:
 *   E2E_BASE_URL
 *   E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD  (fallback: E2E_TEST_EMAIL/PASSWORD)
 *   VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *   E2E_PROJETO_ID
 *   E2E_SECAO_ID
 *   E2E_MEMBER_USER_ID   user_id de outro membro do projeto (será adicionado
 *                        e removido como colaborador)
 */

import { test, expect, type Page } from "@playwright/test";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const BASE_URL = process.env.E2E_BASE_URL ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const PROJETO_ID = process.env.E2E_PROJETO_ID ?? "";
const SECAO_ID = process.env.E2E_SECAO_ID ?? "";
const MEMBER_USER_ID = process.env.E2E_MEMBER_USER_ID ?? "";
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
  await page.getByLabel(/e-?mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/(dashboard|projetos|central)/, { timeout: 30_000 });
}

async function armFlickerObserver(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __flickerSeg?: {
        imgsRemoved: number;
        removedSrcs: string[];
        fallbackAppeared: number;
        baseline: Set<string>;
        stop: () => void;
      };
    };
    w.__flickerSeg?.stop?.();

    const collectAvatarImgs = (root: ParentNode): HTMLImageElement[] =>
      Array.from(
        root.querySelectorAll<HTMLImageElement>(
          'img[data-slot="avatar-image"], [data-slot="avatar"] img',
        ),
      );

    const baseline = new Set<string>(
      collectAvatarImgs(document).map((img) => img.src).filter(Boolean),
    );

    const state = {
      imgsRemoved: 0,
      removedSrcs: [] as string[],
      fallbackAppeared: 0,
      baseline,
      stop: () => obs.disconnect(),
    };

    const isAvatarImg = (el: Element): el is HTMLImageElement =>
      el.tagName === "IMG" &&
      (el.getAttribute("data-slot") === "avatar-image" ||
        !!el.closest('[data-slot="avatar"]'));

    const isAvatarFallback = (el: Element): boolean =>
      el.getAttribute?.("data-slot") === "avatar-fallback" ||
      (!!el.querySelector && !!el.querySelector('[data-slot="avatar-fallback"]'));

    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        m.removedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          const el = n as Element;
          if (isAvatarImg(el)) {
            const src = (el as HTMLImageElement).src;
            if (state.baseline.has(src)) {
              state.imgsRemoved++;
              state.removedSrcs.push(src);
            }
            return;
          }
          const inner = (el as Element).querySelectorAll?.(
            'img[data-slot="avatar-image"], [data-slot="avatar"] img',
          );
          inner?.forEach((img) => {
            const src = (img as HTMLImageElement).src;
            if (state.baseline.has(src)) {
              state.imgsRemoved++;
              state.removedSrcs.push(src);
            }
          });
        });
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          const el = n as Element;
          if (isAvatarFallback(el)) state.fallbackAppeared++;
        });
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
    w.__flickerSeg = state;
  });
}

async function readFlicker(
  page: Page,
): Promise<{ imgsRemoved: number; removedSrcs: string[]; fallbackAppeared: number }> {
  return await page.evaluate(() => {
    const w = window as unknown as {
      __flickerSeg?: {
        imgsRemoved: number;
        removedSrcs: string[];
        fallbackAppeared: number;
      };
    };
    return {
      imgsRemoved: w.__flickerSeg?.imgsRemoved ?? 0,
      removedSrcs: w.__flickerSeg?.removedSrcs ?? [],
      fallbackAppeared: w.__flickerSeg?.fallbackAppeared ?? 0,
    };
  });
}

test.describe("Meus Projetos — colaboradores (seguidores) sem flicker", () => {
  test.skip(
    !BASE_URL || !SUPABASE_URL || !SUPABASE_KEY || !PROJETO_ID || !SECAO_ID,
    "E2E_BASE_URL / VITE_SUPABASE_* / E2E_PROJETO_ID / E2E_SECAO_ID obrigatórios",
  );
  test.skip(!OWNER.email || !OWNER.password, "E2E_OWNER_* obrigatório");
  test.skip(
    !MEMBER_USER_ID,
    "E2E_MEMBER_USER_ID obrigatório (user_id de outro membro do projeto)",
  );

  let owner: SupabaseClient;
  let ownerUid = "";
  let tarefaId = "";
  const trash: string[] = [];

  test.beforeAll(async () => {
    owner = await signIn(OWNER.email, OWNER.password);
    ownerUid = (await owner.auth.getUser()).data.user?.id ?? "";
    expect(ownerUid).toBeTruthy();

    // Cria tarefa apenas com o dono como responsável — seguidores ficam vazios
    // para o teste começar de um estado determinístico.
    const { data, error } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e avatar-sem-flicker colaboradores] tarefa",
        projeto_id: PROJETO_ID,
        secao_id: SECAO_ID,
        responsavel_id: ownerUid,
      })
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

  test("adicionar e remover colaborador não desmonta <img> pré-existentes nem exibe fallback", async ({
    page,
  }) => {
    await loginUi(page, OWNER.email, OWNER.password);
    await page.goto(`/dashboard/projetos/${PROJETO_ID}?tarefa=${tarefaId}`);

    // Aguarda o botão "Adicionar seguidor" — indica que o editor hidratou.
    await page
      .getByRole("button", { name: "Adicionar seguidor", exact: true })
      .first()
      .waitFor({ timeout: 20_000 });

    // Warm-up: dá tempo do preloader de perfis carregar as imagens já visíveis
    // (avatar do responsável dono). Fora da janela do observer — não conta.
    await page.waitForTimeout(1500);

    const clickMember = async () => {
      const options = page.locator('[role="option"], [cmdk-item]');
      await options.first().waitFor({ timeout: 5_000 });
      const count = await options.count();
      for (let i = 0; i < count; i++) {
        const opt = options.nth(i);
        const txt = (await opt.textContent())?.trim() ?? "";
        if (!/atribuir a mim/i.test(txt) && !/remover/i.test(txt)) {
          await opt.click();
          return;
        }
      }
      throw new Error("Nenhum membro clicável no picker de seguidores");
    };

    // ---------- 1) ADD colaborador ----------
    await armFlickerObserver(page);
    await page
      .getByRole("button", { name: "Adicionar seguidor", exact: true })
      .first()
      .click();
    await clickMember();
    // Aguarda patch otimista + eventual settle.
    await page.waitForTimeout(1200);
    const addStats = await readFlicker(page);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    expect(
      addStats.imgsRemoved,
      `add colaborador: <img> pré-existentes desmontados: ${JSON.stringify(addStats.removedSrcs)}`,
    ).toBe(0);
    expect(
      addStats.fallbackAppeared,
      "add colaborador: fallback textual apareceu em avatar já montado",
    ).toBe(0);

    // Espera a nova pill de seguidor estabilizar antes da próxima medição.
    await page.waitForTimeout(500);

    // ---------- 2) REMOVE colaborador ----------
    await armFlickerObserver(page);
    // Cada pill de seguidor é um <button> com title contendo
    // "clique para trocar ou remover" (SubtarefaResponsavelPicker/pill do
    // TarefaResponsavelSeguidoresEditor). Pega a última — recém-adicionada.
    const segPills = page.locator('button[title*="clique para trocar ou remover"]');
    const segCount = await segPills.count();
    expect(segCount, "esperava ao menos uma pill de seguidor após add").toBeGreaterThan(0);
    await segPills.nth(segCount - 1).click();
    await page.getByRole("option", { name: /remover este seguidor/i }).click();
    await page.waitForTimeout(1200);
    const rmStats = await readFlicker(page);
    await page.keyboard.press("Escape");

    // A remoção legítima do próprio avatar da pill que saiu pode contar 1;
    // qualquer valor >1 indica flicker em outros avatares.
    expect(
      rmStats.imgsRemoved,
      `remove colaborador: <img> pré-existentes desmontados além da própria pill: ${JSON.stringify(
        rmStats.removedSrcs,
      )}`,
    ).toBeLessThanOrEqual(1);
    expect(
      rmStats.fallbackAppeared,
      "remove colaborador: fallback textual apareceu em outro avatar",
    ).toBe(0);
  });
});
