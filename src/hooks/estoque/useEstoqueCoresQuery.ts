import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EstoqueCorRow {
  id: string;
  empresa_par: number | null;
  abrev_par: string | null;
  cod_produto: number | null;
  cod_fabricante: string | null;
  nome_prod: string | null;
  nome_linha: string | null;
  unidade_medida: string | null;
  saldo: number | null;
  pedido_pendente: number | null;
  custo_unitario: number | null;
  custo_total: number | null;
  valor_venda: number | null;
  curva_fisica: string | null;
  curva_monetaria: string | null;
  data_ultima_compra: string | null;
  validade: string | null;
  lote: string | null;
  localizacao: string | null;
  estoque_endereco: number | null;
  estoque_bloqueado_produto: number | null;
  estoque_bloqueado_endereco: number | null;
  sincronizado_em: string;
  saldo_proprio: number | null;
  saldo_potencial_desmontagem: number | null;
  saldo_total_disponivel: number | null;
  tem_composicao_pai: boolean | null;
  detalhe_desmontagem:
    | Array<{ cod_pai: number; nome_pai: string | null; saldo_pai: number; fator: number; contribuicao: number }>
    | null;
  total_count: number;
}

export type EstoqueCoresSortKey =
  | 'nome_prod'
  | 'empresa_par'
  | 'saldo'
  | 'saldo_total_disponivel'
  | 'saldo_potencial_desmontagem'
  | 'pedido_pendente'
  | 'custo_total';

export interface EstoqueCoresFiltros {
  busca: string;
  empresas: number[];
  linhas: string[];
  campanha_ids: string[];
  curvas_fisicas: string[];
  curvas_monetarias: string[];
  apenas_com_saldo: boolean;
  com_pedido_pendente: boolean;
  incluir_potencial: boolean;
}

export const FILTROS_CORES_INICIAIS: EstoqueCoresFiltros = {
  busca: '',
  empresas: [],
  linhas: [],
  campanha_ids: [],
  curvas_fisicas: [],
  curvas_monetarias: [],
  apenas_com_saldo: false,
  com_pedido_pendente: false,
  incluir_potencial: true,
};

interface UseOpts {
  filtros: EstoqueCoresFiltros;
  page: number;
  pageSize: number;
  sortBy: EstoqueCoresSortKey;
  sortDir: 'asc' | 'desc';
}

export function useEstoqueCoresQuery({ filtros, page, pageSize, sortBy, sortDir }: UseOpts) {
  return useQuery({
    queryKey: ['estoque-cores', filtros, page, pageSize, sortBy, sortDir],
    placeholderData: keepPreviousData,
    staleTime: 25_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('rpc_estoque_cores', {
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
      });
      if (error) throw error;
      const rows = (data ?? []) as EstoqueCorRow[];
      const total = rows[0]?.total_count ?? 0;
      return { rows, total: Number(total) };
    },
  });
}
