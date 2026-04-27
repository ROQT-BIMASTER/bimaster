import { useMemo } from "react";

/**
 * Compara o universo bruto com o universo filtrado e identifica quantos
 * itens contados em algum KPI estão sendo ESCONDIDOS pelos filtros ativos.
 *
 * Uso típico: o KPI "Em Revisão" conta 6, mas a lista filtrada exibe 5 →
 * o hook devolve `mismatch=true, hidden=1` e detalha o motivo (status,
 * origem, oculto, etc.).
 *
 * Genérico: `T` é o tipo do registro; o caller fornece (a) o predicado que
 * define se o item entra no KPI alvo e (b) o predicado que define se ele
 * passa pelos filtros atuais.
 */
export interface FilterMismatchReason {
  reason: string;
  count: number;
  ids?: string[];
}

export interface FilterMismatchResult<T> {
  totalKpi: number;
  totalLista: number;
  hiddenItems: T[];
  mismatch: boolean;
  reasons: FilterMismatchReason[];
}

export interface UseFilterMismatchInput<T> {
  /** Universo bruto (todos os registros antes de filtrar). */
  rawList: T[] | undefined | null;
  /** Predicado: o item conta no KPI que estamos comparando. */
  countsForKpi: (item: T) => boolean;
  /** Predicado: o item passa em TODOS os filtros atuais (tudo somado). */
  passesAllFilters: (item: T) => boolean;
  /**
   * Por motivo: cada entrada recebe o item escondido e devolve uma string
   * descritiva do filtro que o eliminou (ou `null` se aquele filtro não foi
   * o responsável). Itens podem ser eliminados por múltiplos motivos —
   * todos serão registrados.
   */
  reasonResolvers?: Array<{
    label: string;
    isResponsible: (item: T) => boolean;
  }>;
  /** Função para extrair o ID do item (opcional, para depuração). */
  getId?: (item: T) => string | undefined;
}

export function useFilterMismatch<T>(input: UseFilterMismatchInput<T>): FilterMismatchResult<T> {
  const {
    rawList,
    countsForKpi,
    passesAllFilters,
    reasonResolvers = [],
    getId,
  } = input;

  return useMemo(() => {
    const list = rawList ?? [];
    const inKpi = list.filter(countsForKpi);
    const visible = inKpi.filter(passesAllFilters);
    const hidden = inKpi.filter((it) => !passesAllFilters(it));

    const reasons: FilterMismatchReason[] = reasonResolvers
      .map(({ label, isResponsible }) => {
        const matches = hidden.filter(isResponsible);
        return {
          reason: label,
          count: matches.length,
          ids: getId ? matches.map(getId).filter((x): x is string => !!x) : undefined,
        };
      })
      .filter((r) => r.count > 0);

    return {
      totalKpi: inKpi.length,
      totalLista: visible.length,
      hiddenItems: hidden,
      mismatch: hidden.length > 0,
      reasons,
    };
  }, [rawList, countsForKpi, passesAllFilters, reasonResolvers, getId]);
}
