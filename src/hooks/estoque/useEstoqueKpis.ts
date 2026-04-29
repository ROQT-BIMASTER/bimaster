import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { filtrosParaJsonb, type EstoqueFiltros } from '@/lib/estoque/estoqueFilters';

export interface EstoqueKpis {
  total_registros: number;
  valor_total: number;
  unidades_total: number;
  skus_ativos: number;
  skus_sem_saldo: number;
  skus_negativos: number;
  pedidos_pendentes_qtd: number;
  skus_com_pendente: number;
  ultima_sync: string | null;
  empresas_no_recorte: number;
  linhas_no_recorte: number;
}

export function useEstoqueKpis(filtros: EstoqueFiltros) {
  return useQuery({
    queryKey: ['estoque-kpis-recorte', filtros],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('estoque_kpis_recorte', {
        filtros: filtrosParaJsonb(filtros) as any,
      });
      if (error) throw error;
      return data as unknown as EstoqueKpis;
    },
  });
}
