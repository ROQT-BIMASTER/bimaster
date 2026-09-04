/**
 * Decide se a reordenação manual (drag & drop) da lista de tarefas/seções
 * pode ser aplicada, e por que motivo está indisponível quando for o caso.
 *
 * Regra: arrastar só faz sentido quando a ordem exibida na tela reflete a
 * ordem persistida. Com filtro ativo ou ordenação custom, a nova posição
 * seria enganosa.
 */

export type ReorderMotivo = "filtro" | "ordenacao" | "secao_muito_longa";

export interface ReorderStatus {
  enabled: boolean;
  motivo: ReorderMotivo | null;
  /** Mensagem curta para exibir ao usuário. */
  mensagem: string | null;
}

/** Acima deste tamanho a seção é virtualizada e o arrastar é desativado. */
export const REORDER_MAX_TAREFAS = 300;

const MENSAGENS: Record<ReorderMotivo, string> = {
  filtro: "Reordenação indisponível com filtros ativos.",
  ordenacao: "Reordenação indisponível com ordenação personalizada.",
  secao_muito_longa: `Reordenação indisponível em seções com mais de ${REORDER_MAX_TAREFAS} tarefas.`,
};

export function getReorderStatus(params: {
  isFiltering: boolean;
  sortField: string;
  sortDirection: string;
}): ReorderStatus {
  if (params.isFiltering) {
    return { enabled: false, motivo: "filtro", mensagem: MENSAGENS.filtro };
  }
  if (params.sortField !== "created_at" || params.sortDirection !== "asc") {
    return { enabled: false, motivo: "ordenacao", mensagem: MENSAGENS.ordenacao };
  }
  return { enabled: true, motivo: null, mensagem: null };
}

/** Status por seção — considera o tamanho da seção além do status global. */
export function getReorderStatusSecao(
  base: ReorderStatus,
  totalTarefas: number,
): ReorderStatus {
  if (!base.enabled) return base;
  if (totalTarefas > REORDER_MAX_TAREFAS) {
    return {
      enabled: false,
      motivo: "secao_muito_longa",
      mensagem: MENSAGENS.secao_muito_longa,
    };
  }
  return base;
}
