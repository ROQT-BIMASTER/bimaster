// Filtros globais da tela Resultados de Vendas (Futura)
// Compartilhado por todos os blocos/hooks para reagirem juntos.
export interface VendasGlobalFilters {
  ano: number;
  empresa: number | null;
  tabelaPrecoId: number | null;
  uf: string | null;
  clienteId: number | null;
  vendedorId: number | null;
}

export function initialGlobalFilters(ano: number): VendasGlobalFilters {
  return {
    ano,
    empresa: null,
    tabelaPrecoId: null,
    uf: null,
    clienteId: null,
    vendedorId: null,
  };
}
