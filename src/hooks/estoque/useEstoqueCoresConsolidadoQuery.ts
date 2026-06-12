import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EstoqueCoresFiltros } from './useEstoqueCoresQuery';

export interface DetalheDesmontagemItem {
  cod_pai: number;
  nome_pai: string | null;
  saldo_pai: number;
  fator: number;
  contribuicao: number;
}

export interface EstoqueCorEmpresaBreakdown {
  empresa_par: number;
  abrev_par: string | null;
  saldo_proprio: number;
  saldo_potencial_desmontagem: number;
  saldo_total_disponivel: number;
  pedido_pendente: number;
  estoque_endereco: number;
  estoque_bloqueado_produto: number;
  estoque_bloqueado_endereco: number;
  detalhe_desmontagem: DetalheDesmontagemItem[] | null;
}

export interface EstoqueCorConsolidadoRow {
  cod_produto: number | null;
  cod_fabricante: string | null;
  nome_prod: string | null;
  nome_linha: string | null;
  unidade_medida: string | null;
  curva_fisica: string | null;
  curva_monetaria: string | null;
  qtd_empresas: number;
  saldo_proprio: number | null;
  saldo_potencial_desmontagem: number | null;
  saldo_total_disponivel: number | null;
  pedido_pendente: number | null;
  estoque_endereco: number | null;
  estoque_bloqueado_produto: number | null;
  estoque_bloqueado_endereco: number | null;
  por_empresa: EstoqueCorEmpresaBreakdown[] | null;
  total_count: number;
  tem_divergencia_linha: boolean | null;
  linhas_divergentes: string[] | null;
}

export type EstoqueCoresConsolidadoSortKey =
  | 'nome_prod'
  | 'saldo'
  | 'saldo_total_disponivel'
  | 'saldo_potencial_desmontagem'
  | 'pedido_pendente';

interface UseOpts {
  filtros: EstoqueCoresFiltros;
  page: number;
  pageSize: number;
  sortBy: EstoqueCoresConsolidadoSortKey;
  sortDir: 'asc' | 'desc';
  enabled?: boolean;
}

export function useEstoqueCoresConsolidadoQuery({
  filtros,
  page,
  pageSize,
  sortBy,
  sortDir,
  enabled = true,
}: UseOpts) {
  return useQuery({
    queryKey: ['estoque-cores-consolidado', filtros, page, pageSize, sortBy, sortDir],
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 600_000,
    refetchInterval: 600_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('rpc_estoque_cores_consolidado', {
        p_empresas: filtros.empresas.length ? filtros.empresas : null,
        p_linhas: filtros.linhas.length ? filtros.linhas : null,
        p_campanha_ids: filtros.campanha_ids.length ? filtros.campanha_ids : null,
        p_busca: filtros.busca || null,
        p_apenas_com_saldo: filtros.apenas_com_saldo,
        p_com_pedido_pendente: filtros.com_pedido_pendente,
        p_curva_fisica: filtros.curvas_fisicas.length ? filtros.curvas_fisicas : null,
        p_curva_monetaria: filtros.curvas_monetarias.length ? filtros.curvas_monetarias : null,
        p_incluir_potencial: filtros.incluir_potencial,
        p_limit: pageSize,
        p_offset: page * pageSize,
        p_order_by: sortBy,
        p_order_dir: sortDir,
        p_apenas_divergencia_linha: filtros.apenas_divergencia_linha,
      });
      if (error) throw error;
      const rows = (data ?? []) as EstoqueCorConsolidadoRow[];
      const total = rows[0]?.total_count ?? 0;
      return { rows, total: Number(total) };
    },
  });
}

export interface EstoqueCoresKpisConsolidado {
  total_skus: number;
  total_unidades: number;
  total_unidades_potencial: number;
  total_pedido_pendente: number;
  itens_sem_saldo: number;
  total_bloqueado_produto: number;
}

export function useEstoqueCoresKpisConsolidado(filtros: EstoqueCoresFiltros, enabled = true) {
  return useQuery({
    queryKey: ['estoque-cores-kpis-consolidado', filtros],
    enabled,
    staleTime: 600_000,
    refetchInterval: 600_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('rpc_estoque_cores_kpis_consolidado', {
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
      const row = (data?.[0] ?? {}) as EstoqueCoresKpisConsolidado;
      return {
        total_skus: Number(row.total_skus ?? 0),
        total_unidades: Number(row.total_unidades ?? 0),
        total_unidades_potencial: Number(row.total_unidades_potencial ?? 0),
        total_pedido_pendente: Number(row.total_pedido_pendente ?? 0),
        itens_sem_saldo: Number(row.itens_sem_saldo ?? 0),
        total_bloqueado_produto: Number(row.total_bloqueado_produto ?? 0),
      };
    },
  });
}
