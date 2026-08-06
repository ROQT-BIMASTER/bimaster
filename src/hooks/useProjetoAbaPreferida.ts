import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Persiste a última aba de trabalho escolhida em um projeto.
 *
 * Regra de produto (solicitação dos usuários): ao abrir um projeto pela
 * primeira vez a visão padrão é **Lista**. A partir daí, a última aba usada
 * — por projeto — é lembrada, e quem prefere Quadro não perde a preferência.
 *
 * Guardado em localStorage: é preferência de UI, não dado de negócio.
 */

const KEY_PROJETO = (projetoId: string) => `projeto:aba:${projetoId}`;
const KEY_GLOBAL = "projeto:aba:ultima";
const DEFAULT_TAB = "lista";

/** Somente abas de trabalho são memorizadas (chat/painel etc. não viram padrão). */
const REMEMBERABLE = new Set(["lista", "quadro", "cronograma", "calendario", "prazos"]);

function readInitialTab(projetoId: string | undefined, forced: string | null): string {
  if (forced) return forced;
  if (typeof window === "undefined") return DEFAULT_TAB;
  try {
    const perProjeto = projetoId ? window.localStorage.getItem(KEY_PROJETO(projetoId)) : null;
    if (perProjeto && REMEMBERABLE.has(perProjeto)) return perProjeto;
    const global = window.localStorage.getItem(KEY_GLOBAL);
    if (global && REMEMBERABLE.has(global)) return global;
  } catch {
    /* modo privado / quota — usa o padrão */
  }
  return DEFAULT_TAB;
}

export function useProjetoAbaPreferida(projetoId: string | undefined, forcedTab: string | null = null) {
  const [activeTab, setActiveTabState] = useState(() => readInitialTab(projetoId, forcedTab));
  const projetoRef = useRef(projetoId);

  // Ao trocar de projeto na mesma sessão, recarrega a preferência daquele projeto.
  useEffect(() => {
    if (projetoRef.current === projetoId) return;
    projetoRef.current = projetoId;
    setActiveTabState(readInitialTab(projetoId, forcedTab));
  }, [projetoId, forcedTab]);

  const setActiveTab = useCallback(
    (tab: string) => {
      setActiveTabState(tab);
      if (typeof window === "undefined" || !REMEMBERABLE.has(tab)) return;
      try {
        if (projetoId) window.localStorage.setItem(KEY_PROJETO(projetoId), tab);
        window.localStorage.setItem(KEY_GLOBAL, tab);
      } catch {
        /* noop */
      }
    },
    [projetoId],
  );

  return { activeTab, setActiveTab };
}

export const PROJETO_ABA_PADRAO = DEFAULT_TAB;
