import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { awaitCacheUnificadoFresh } from '@/lib/estoque/cacheFreshness';
import { logger } from '@/lib/logger';

export interface EstoqueUnificadoServerTotals {
  total_un: number;
  bloqueado_un: number;
  disponivel_un: number;
  pendente_un: number;
  caixas: number;
  displays: number;
  unidades: number;
  custo_total: number;
  produtos_count: number;
  disponivel_cx: number;
  sem_fator_cx: number;
  equivalente_cx: number;
  equivalente_bx: number;
  sem_fator_bx: number;
}

export interface UseEstoqueUnificadoKpisOpts {
  empresaIds: number[];
  somenteComSaldo: boolean;
  marcas?: string[];
  linhas?: string[];
  busca?: string;
}

/**
 * KPIs do Estoque Unificado calculados no servidor a partir de
 * `estoque_unificado_cache` — mesma fonte da tela Conciliação,
 * garantindo paridade exata de totais entre as duas telas.
 */
export function useEstoqueUnificadoKpis(opts: UseEstoqueUnificadoKpisOpts) {
  const normalized = {
    empresaIds: [...opts.empresaIds].sort((a, b) => a - b),
    somenteComSaldo: !!opts.somenteComSaldo,
    marcas: [...(opts.marcas ?? [])].sort(),
    linhas: [...(opts.linhas ?? [])].sort(),
    busca: (opts.busca ?? '').trim().toLowerCase(),
  };
  return useQuery({
    queryKey: ['estoque-unificado-kpis', normalized],
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async (): Promise<EstoqueUnificadoServerTotals | null> => {
      await awaitCacheUnificadoFresh();
      const { data, error } = await supabase.rpc('rpc_estoque_unificado_kpis' as any, {
        p_empresa_ids: normalized.empresaIds.length ? normalized.empresaIds : null,
        p_somente_com_saldo: normalized.somenteComSaldo,
        p_marcas: normalized.marcas.length ? normalized.marcas : null,
        p_linhas: normalized.linhas.length ? normalized.linhas : null,
        p_busca: normalized.busca || null,
      } as any);
      if (error) {
        logger.error('[useEstoqueUnificadoKpis] erro RPC', { error });
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      const n = (v: any) => Number(v ?? 0);
      return {
        total_un: n(row.total_un),
        bloqueado_un: n(row.bloqueado_un),
        disponivel_un: n(row.disponivel_un),
        pendente_un: n(row.pendente_un),
        caixas: n(row.caixas),
        displays: n(row.displays),
        unidades: n(row.unidades),
        custo_total: n(row.custo_total),
        produtos_count: n(row.produtos_count),
        disponivel_cx: n(row.disponivel_cx),
        sem_fator_cx: n(row.sem_fator_cx),
        equivalente_cx: n(row.equivalente_cx),
        equivalente_bx: n(row.equivalente_bx),
        sem_fator_bx: n(row.sem_fator_bx),
      };
    },
  });
}
