/**
 * Estado persistido dos filtros e da ordenação por situação de documento.
 *
 * O estado é salvo por escopo (quadro do projeto ou tarefa) em localStorage,
 * para que o usuário reencontre a mesma seleção ao recarregar a página.
 */
import { useCallback, useEffect, useState } from "react";
import type { DocDecisao } from "@/lib/china/docStatus";
import type { DocSortKey } from "@/lib/china/docSort";

const DECISOES: DocDecisao[] = ["pendente", "em_analise", "aprovado", "rejeitado"];
const SORTS: DocSortKey[] = ["none", "atualizacao", "proxima_acao"];

export interface DocFilterState {
  selected: DocDecisao[];
  sort: DocSortKey;
}

const VAZIO: DocFilterState = { selected: [], sort: "none" };

function storageKey(scope: string) {
  return `china-doc-filtro:${scope}`;
}

function ler(scope: string): DocFilterState {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    if (!raw) return VAZIO;
    const parsed = JSON.parse(raw) as Partial<DocFilterState>;
    const selected = Array.isArray(parsed.selected)
      ? parsed.selected.filter((d): d is DocDecisao => DECISOES.includes(d as DocDecisao))
      : [];
    const sort = SORTS.includes(parsed.sort as DocSortKey) ? (parsed.sort as DocSortKey) : "none";
    return { selected, sort };
  } catch {
    return VAZIO;
  }
}

export function useDocStatusFilterState(scope: string | undefined) {
  const key = scope || "global";
  const [state, setState] = useState<DocFilterState>(() => (scope ? ler(key) : VAZIO));

  // Troca de escopo (outro projeto / outra tarefa) recarrega o estado salvo.
  useEffect(() => {
    setState(ler(key));
  }, [key]);

  useEffect(() => {
    try {
      if (state.selected.length === 0 && state.sort === "none") {
        localStorage.removeItem(storageKey(key));
      } else {
        localStorage.setItem(storageKey(key), JSON.stringify(state));
      }
    } catch {
      /* storage indisponível — filtro segue apenas em memória */
    }
  }, [key, state]);

  const setSelected = useCallback(
    (selected: DocDecisao[]) => setState((s) => ({ ...s, selected })),
    [],
  );
  const setSort = useCallback((sort: DocSortKey) => setState((s) => ({ ...s, sort })), []);

  return { selected: state.selected, sort: state.sort, setSelected, setSort };
}
