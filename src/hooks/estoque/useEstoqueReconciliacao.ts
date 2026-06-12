import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ReconciliacaoRow {
  empresa: number | null;
  abrev_empresa: string | null;
  cod_raiz: number | null;
  nome_raiz: string | null;
  nome_linha: string | null;
  qtd_cores: number;
  skus_unificado: number;
  un_cores: number;
  un_unificado: number;
  delta_un: number;
  delta_pct: number | null;
  fator_cx_para_un: number;
  cx_cores: number | null;
  cx_unificado: number | null;
  disponivel_un_unificado: number;
  bloqueado_un_unificado: number;
  status: 'ok' | 'divergente' | 'ausente_em_cores' | 'ausente_em_unificado';
  total_count: number;
}

export type ReconciliacaoSortKey =
  | 'nome_raiz'
  | 'un_cores'
  | 'un_unificado'
  | 'delta_un'
  | 'delta_abs'
  | 'empresa';

export interface ReconciliacaoFiltros {
  empresas: number[];
  linhas: string[];
  busca: string;
  apenas_divergentes: boolean;
  tolerancia: number;
}

export const RECON_FILTROS_INICIAIS: ReconciliacaoFiltros = {
  empresas: [],
  linhas: [],
  busca: '',
  apenas_divergentes: false,
  tolerancia: 0.0001,
};

interface Opts {
  filtros: ReconciliacaoFiltros;
  page: number;
  pageSize: number;
  sortBy: ReconciliacaoSortKey;
  sortDir: 'asc' | 'desc';
}

export function useEstoqueReconciliacaoQuery({ filtros, page, pageSize, sortBy, sortDir }: Opts) {
  return useQuery({
    queryKey: ['estoque-recon', filtros, page, pageSize, sortBy, sortDir],
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('rpc_estoque_cores_vs_unificado', {
        p_empresas: filtros.empresas.length ? filtros.empresas : null,
        p_linhas: filtros.linhas.length ? filtros.linhas : null,
        p_busca: filtros.busca || null,
        p_apenas_divergentes: filtros.apenas_divergentes,
        p_tolerancia: filtros.tolerancia,
        p_limit: pageSize,
        p_offset: page * pageSize,
        p_order_by: sortBy,
        p_order_dir: sortDir,
      });
      if (error) throw error;
      const rows = (data ?? []) as ReconciliacaoRow[];
      const total = rows[0]?.total_count ?? 0;
      return { rows, total: Number(total) };
    },
  });
}

export interface ReconciliacaoKpis {
  raizes_auditadas: number;
  raizes_ok: number;
  raizes_divergentes: number;
  raizes_so_em_cores: number;
  raizes_so_em_unificado: number;
  delta_abs_total_un: number;
  delta_abs_total_cx: number;
}

export function useEstoqueReconciliacaoKpis(filtros: ReconciliacaoFiltros) {
  return useQuery({
    queryKey: ['estoque-recon-kpis', filtros.empresas, filtros.linhas, filtros.tolerancia],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('rpc_estoque_cores_vs_unificado_kpis', {
        p_empresas: filtros.empresas.length ? filtros.empresas : null,
        p_linhas: filtros.linhas.length ? filtros.linhas : null,
        p_tolerancia: filtros.tolerancia,
      });
      if (error) throw error;
      const r = (data?.[0] ?? {}) as ReconciliacaoKpis;
      return {
        raizes_auditadas: Number(r.raizes_auditadas ?? 0),
        raizes_ok: Number(r.raizes_ok ?? 0),
        raizes_divergentes: Number(r.raizes_divergentes ?? 0),
        raizes_so_em_cores: Number(r.raizes_so_em_cores ?? 0),
        raizes_so_em_unificado: Number(r.raizes_so_em_unificado ?? 0),
        delta_abs_total_un: Number(r.delta_abs_total_un ?? 0),
        delta_abs_total_cx: Number(r.delta_abs_total_cx ?? 0),
      };
    },
  });
}
