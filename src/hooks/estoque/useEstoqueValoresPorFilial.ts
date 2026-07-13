import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { filtrosParaJsonb, type EstoqueFiltros } from '@/lib/estoque/estoqueFilters';

export interface EstoqueFilialRow {
  empresa_par: number;
  abrev_par: string;
  valor_total: number;
  unidades_total: number;
  total_registros: number;
  skus_ativos: number;
  skus_sem_saldo: number;
  skus_negativos: number;
  pedidos_pendentes_qtd: number;
  skus_com_pendente: number;
  ultima_sync: string | null;
}

export function useEstoqueValoresPorFilial(filtros: EstoqueFiltros) {
  return useQuery({
    queryKey: ['estoque-valores-por-filial', 'v2-erp-informacoesprodutos', filtros],
    // Sempre buscar fresco: o RPC lê direto da erp_estoque_distribuidora (sync ERP).
    staleTime: 0,
    gcTime: 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      // RPC ainda não está nos tipos gerados do Supabase -> cast controlado.
      const { data, error } = await (supabase.rpc as any)('estoque_valores_por_filial', {
        filtros: filtrosParaJsonb(filtros),
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        empresa_par: Number(r.empresa_par),
        abrev_par: r.abrev_par ?? `Empresa ${r.empresa_par}`,
        valor_total: Number(r.valor_total ?? 0),
        unidades_total: Number(r.unidades_total ?? 0),
        total_registros: Number(r.total_registros ?? 0),
        skus_ativos: Number(r.skus_ativos ?? 0),
        skus_sem_saldo: Number(r.skus_sem_saldo ?? 0),
        skus_negativos: Number(r.skus_negativos ?? 0),
        pedidos_pendentes_qtd: Number(r.pedidos_pendentes_qtd ?? 0),
        skus_com_pendente: Number(r.skus_com_pendente ?? 0),
        ultima_sync: r.ultima_sync ?? null,
      })) as EstoqueFilialRow[];
    },
  });
}
