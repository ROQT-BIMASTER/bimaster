// Barrel para hooks de histórico do item de aprovação.
// Importe sempre a partir de "@/hooks/itemHistorico" para padronizar.
export {
  useItemHistorico,
  useComentarItem,
  HISTORICO_PAGE_SIZE,
} from "@/hooks/useItemHistorico";
export type {
  HistoricoEntry,
  HistoricoFilters,
} from "@/hooks/useItemHistorico";
