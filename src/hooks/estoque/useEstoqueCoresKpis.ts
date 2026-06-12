import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { awaitCacheUnificadoFresh } from '@/lib/estoque/cacheFreshness';
import type { EstoqueCoresFiltros } from './useEstoqueCoresQuery';

export interface EstoqueCoresKpis {
  total_skus: number;
  total_unidades: number;
  total_unidades_potencial: number;
  total_custo: number;
  total_valor_venda: number;
  total_pedido_pendente: number;
  itens_sem_saldo: number;
  total_bloqueado_produto: number;
}

export function useEstoqueCoresKpis(filtros: EstoqueCoresFiltros) {
  return useQuery({
    queryKey: ['estoque-cores-kpis', filtros],
    staleTime: 25_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      await awaitCacheUnificadoFresh();
      const { data, error } = await (supabase as any).rpc('rpc_estoque_cores_kpis', {
        p_empresas: filtros.empresas.length ? filtros.empresas : null,
        p_linhas: filtros.linhas.length ? filtros.linhas : null,
        p_campanha_ids: filtros.campanha_ids.length ? filtros.campanha_ids : null,
        p_busca: filtros.busca || null,
        p_apenas_com_saldo: filtros.apenas_com_saldo,
        p_com_pedido_pendente: filtros.com_pedido_pendente,
        p_curva_fisica: filtros.curvas_fisicas.length ? filtros.curvas_fisicas : null,
        p_curva_monetaria: filtros.curvas_monetarias.length ? filtros.curvas_monetarias : null,
        p_incluir_potencial: filtros.incluir_potencial,
      });
      if (error) throw error;
      const row = (data?.[0] ?? {}) as EstoqueCoresKpis;
      return {
        total_skus: Number(row.total_skus ?? 0),
        total_unidades: Number(row.total_unidades ?? 0),
        total_unidades_potencial: Number(row.total_unidades_potencial ?? 0),
        total_custo: Number(row.total_custo ?? 0),
        total_valor_venda: Number(row.total_valor_venda ?? 0),
        total_pedido_pendente: Number(row.total_pedido_pendente ?? 0),
        itens_sem_saldo: Number(row.itens_sem_saldo ?? 0),
        total_bloqueado_produto: Number(row.total_bloqueado_produto ?? 0),
      };
    },
  });
}
