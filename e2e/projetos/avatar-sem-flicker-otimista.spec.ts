/**
 * E2E — Avatares NÃO piscam no patch otimista (Meus Projetos → detalhe da tarefa).
 *
 * Regressão coberta:
 *   Em versões anteriores, adicionar/remover responsáveis ou colaboradores no
 *   drawer de detalhe da tarefa (`ProjetoTarefaDetalhe` →
 *   `TarefaResponsavelSeguidoresEditor`) causava um "flicker": o `<img>` do
 *   `SmartAvatar` desmontava e o fallback textual aparecia brevemente enquanto
 *   o cache do TanStack Query re-fetchava dados de perfil / a imagem passava
 *   por outro round-trip HTTP. Depois do fix (`3.5.92`), a operação usa patch
 *   otimista + warm-up de cache/imagem, então o `<img>` deve permanecer
 *   montado do início ao fim.
 *
 * Estratégia (não depende de foto real carregar):
 *   1. Cria uma tarefa fixture com o dono como responsável e, se disponível,
 *      um membro extra (E2E_MEMBER_USER_ID) como seguidor.
 *   2. Abre `/dashboard/projetos/<id>?tarefa=<id>` autenticado.
 *   3. Injeta um `MutationObserver` no body que conta remoções de `<img>` e
 *      montagens de `[data-slot="avatar-fallback"]` (fallback do shadcn/ui)
 *      DURANTE a janela de cada ação (add responsável, add seguidor, remover
 *      seguidor, remover responsável). Fora da janela nada é contado — evita
 *      false-positive de popover fechando/abrindo.
 *   4. Executa 4 ações e, após cada uma, coleta o delta e asserta:
 *        - `imgsRemoved === 0`   → nenhum `<img>` de avatar já montado saiu.
 *        - `fallbackAppeared === 0` → nenhum fallback textual "brilhou".
 *      Uma nova pill (novo membro entrando/saindo do array) inevitavelmente
 *      cria/destrói o `<img>` daquela pill — o observer ignora isso comparando
 *      o `src` do `<img>` removido contra o snapshot pré-ação: só é flicker
 *      quando um `src` que existia ANTES da ação some DURANTE a ação.
 *
 * Env obrigatórias (mesmas dos outros specs de projetos):
 *   E2E_BASE_URL
 *   E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD  (fallback: E2E_TEST_EMAIL/PASSWORD)
 *   VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *   E2E_PROJETO_ID
 *   E2E_SECAO_ID
 *   E2E_MEMBER_USER_ID   user_id de outro membro do projeto para add/remove
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

/**
 * Instala/reinicia o observer de flicker. Snapshot dos `<img src>` de avatar
 * atualmente na árvore é congelado; a janela seguinte só conta como flicker
 * a remoção de um `<img>` cujo `src` estava nesse snapshot.
 */
async function armFlickerObserver(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __flicker?: {
        imgsRemoved: number;
        removedSrcs: string[];
        fallbackAppeared: number;
        baseline: Set<string>;
        stop: () => void;
      };
    };
    w.__flicker?.stop?.();

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
    w.__flicker = state;
  });
}

async function readFlicker(
  page: Page,
): Promise<{ imgsRemoved: number; removedSrcs: string[]; fallbackAppeared: number }> {
  return await page.evaluate(() => {
    const w = window as unknown as {
      __flicker?: {
        imgsRemoved: number;
        removedSrcs: string[];
        fallbackAppeared: number;
      };
    };
    return {
      imgsRemoved: w.__flicker?.imgsRemoved ?? 0,
      removedSrcs: w.__flicker?.removedSrcs ?? [],
      fallbackAppeared: w.__flicker?.fallbackAppeared ?? 0,
    };
  });
}

test.describe("Meus Projetos — avatar sem flicker em patch otimista", () => {
  test.skip(
    !BASE_URL || !SUPABASE_URL || !SUPABASE_KEY || !PROJETO_ID || !SECAO_ID,
    "E2E_BASE_URL / VITE_SUPABASE_* / E2E_PROJETO_ID / E2E_SECAO_ID obrigatórios",
  );
  test.skip(!OWNER.email || !OWNER.password, "E2E_OWNER_* obrigatório");
  test.skip(!MEMBER_USER_ID, "E2E_MEMBER_USER_ID obrigatório (user_id de outro membro do projeto)");

  let owner: SupabaseClient;
  let ownerUid = "";
  let tarefaId = "";
  const trash: string[] = [];

  test.beforeAll(async () => {
    owner = await signIn(OWNER.email, OWNER.password);
    ownerUid = (await owner.auth.getUser()).data.user?.id ?? "";
    expect(ownerUid).toBeTruthy();

    const { data, error } = await owner
      .from("projeto_tarefas")
      .insert({
        titulo: "[e2e avatar-sem-flicker] tarefa",
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

  test("adicionar+remover responsável e seguidor não desmonta <img> nem exibe fallback", async ({
    page,
  }) => {
    await loginUi(page, OWNER.email, OWNER.password);
    await page.goto(`/dashboard/projetos/${PROJETO_ID}?tarefa=${tarefaId}`);

    // Aguarda o editor de responsáveis/seguidores dentro do drawer.
    await page
      .getByRole("button", { name: "Adicionar responsável", exact: true })
      .first()
      .waitFor({ timeout: 20_000 });

    // Warm-up: dá tempo do preloader hidratar `profile-mini` e as imagens
    // dos membros — fora da janela do observer, então não conta como flicker.
    await page.waitForTimeout(1500);

    const clickMember = async () => {
      // Espera o Command popover e clica no primeiro membro que não é o dono.
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
      throw new Error("Nenhum membro clicável no picker");
    };

    const runAction = async (
      label: string,
      openBtn: () => Promise<void>,
    ): Promise<{ imgsRemoved: number; removedSrcs: string[]; fallbackAppeared: number }> => {
      await armFlickerObserver(page);
      await openBtn();
      await clickMember();
      // Aguarda o toast/patch otimista + eventual settle do TanStack Query.
      await page.waitForTimeout(1200);
      const stats = await readFlicker(page);
      // Fecha qualquer popover aberto.
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
      return { ...stats, ...{ label } as unknown as object } as typeof stats;
    };

    // 1) Adiciona um responsável.
    const addResp = await runAction("add-responsavel", async () => {
      await page.getByRole("button", { name: "Adicionar responsável", exact: true }).first().click();
    });
    expect(
      addResp.imgsRemoved,
      `add responsável: <img> pré-existentes desmontados: ${JSON.stringify(addResp.removedSrcs)}`,
    ).toBe(0);
    expect(addResp.fallbackAppeared, "add responsável: fallback textual apareceu").toBe(0);

    // 2) Adiciona um seguidor.
    const addSeg = await runAction("add-seguidor", async () => {
      await page.getByRole("button", { name: "Adicionar seguidor", exact: true }).first().click();
    });
    expect(
      addSeg.imgsRemoved,
      `add seguidor: <img> pré-existentes desmontados: ${JSON.stringify(addSeg.removedSrcs)}`,
    ).toBe(0);
    expect(addSeg.fallbackAppeared, "add seguidor: fallback textual apareceu").toBe(0);

    // 3) Remove o seguidor recém-adicionado (abrindo seu popover e usando
    //    "Remover este seguidor" no picker).
    await armFlickerObserver(page);
    // Clica no último avatar de seguidor (o recém-adicionado é o último na pilha).
    const segAvatars = page.locator('button[title*="clique para trocar ou remover"]');
    const segCount = await segAvatars.count();
    // O último costuma ser o recém-adicionado; percorre do fim ao início.
    await segAvatars.nth(segCount - 1).click();
    await page.getByRole("option", { name: /remover este seguidor/i }).click();
    await page.waitForTimeout(1200);
    const rmSeg = await readFlicker(page);
    await page.keyboard.press("Escape");
    expect(
      rmSeg.imgsRemoved,
      `remove seguidor: <img> pré-existentes desmontados: ${JSON.stringify(rmSeg.removedSrcs)}`,
    ).toBeLessThanOrEqual(1); // o próprio avatar removido conta — tolerar 1.
    expect(rmSeg.fallbackAppeared, "remove seguidor: fallback textual apareceu em outro avatar").toBe(0);

    // 4) Remove o responsável recém-adicionado do mesmo modo.
    await armFlickerObserver(page);
    const respAvatars = page.locator('button[title*="clique para trocar ou remover"]');
    const respCount = await respAvatars.count();
    await respAvatars.nth(respCount - 1).click();
    await page.getByRole("option", { name: /remover este responsável/i }).click();
    await page.waitForTimeout(1200);
    const rmResp = await readFlicker(page);
    expect(
      rmResp.imgsRemoved,
      `remove responsável: <img> pré-existentes desmontados: ${JSON.stringify(rmResp.removedSrcs)}`,
    ).toBeLessThanOrEqual(1);
    expect(rmResp.fallbackAppeared, "remove responsável: fallback textual apareceu em outro avatar").toBe(0);
  });
});
