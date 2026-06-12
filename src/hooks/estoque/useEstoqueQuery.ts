import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { EstoqueFiltros } from '@/lib/estoque/estoqueFilters';

export interface EstoqueRow {
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
}

const COLS = 'id,empresa_par,abrev_par,cod_produto,cod_fabricante,nome_prod,nome_linha,unidade_medida,saldo,pedido_pendente,custo_unitario,custo_total,valor_venda,curva_fisica,curva_monetaria,data_ultima_compra,validade,lote,localizacao,estoque_endereco,estoque_bloqueado_produto,estoque_bloqueado_endereco,sincronizado_em';

export type EstoqueSortKey =
  | 'nome_prod' | 'saldo' | 'custo_total' | 'custo_unitario'
  | 'pedido_pendente' | 'data_ultima_compra' | 'curva_fisica' | 'curva_monetaria' | 'empresa_par';

export interface UseEstoqueQueryOpts {
  filtros: EstoqueFiltros;
  page: number;
  pageSize: number;
  sortBy: EstoqueSortKey;
  sortDir: 'asc' | 'desc';
}

export function useEstoqueQuery({ filtros, page, pageSize, sortBy, sortDir }: UseEstoqueQueryOpts) {
  return useQuery({
    queryKey: ['estoque-erp-list', filtros, page, pageSize, sortBy, sortDir],
    placeholderData: keepPreviousData,
    staleTime: 600_000,
    refetchInterval: 600_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      let q = supabase.from('erp_estoque_distribuidora').select(COLS, { count: 'exact' });

      if (filtros.busca) {
        const b = filtros.busca.trim();
        q = q.or(`nome_prod.ilike.%${b}%,cod_fabricante.ilike.%${b}%,erp_id.ilike.%${b}%`);
      }
      if (filtros.empresa_ids.length) q = q.in('empresa_par', filtros.empresa_ids);
      if (filtros.linhas.length) q = q.in('nome_linha', filtros.linhas);
      if (filtros.unidades.length) q = q.in('unidade_medida', filtros.unidades);
      if (filtros.curvas_fisicas.length) q = q.in('curva_fisica', filtros.curvas_fisicas);
      if (filtros.curvas_monetarias.length) q = q.in('curva_monetaria', filtros.curvas_monetarias);
      if (filtros.apenas_com_saldo) q = q.gt('saldo', 0);
      if (filtros.com_pedido_pendente) q = q.gt('pedido_pendente', 0);
      if (filtros.saldo_min != null) q = q.gte('saldo', filtros.saldo_min);
      if (filtros.saldo_max != null) q = q.lte('saldo', filtros.saldo_max);
      if (filtros.valor_min != null) q = q.gte('custo_total', filtros.valor_min);
      if (filtros.valor_max != null) q = q.lte('custo_total', filtros.valor_max);
      if (filtros.ultima_compra_dias != null) {
        const d = new Date();
        d.setDate(d.getDate() - filtros.ultima_compra_dias);
        q = q.gte('data_ultima_compra', d.toISOString().slice(0, 10));
      }
      if (filtros.sem_compra) {
        const d = new Date();
        d.setDate(d.getDate() - 180);
        q = q.or(`data_ultima_compra.is.null,data_ultima_compra.lt.${d.toISOString().slice(0, 10)}`);
      }
      const hojeISO = new Date().toISOString().slice(0, 10);
      if (filtros.vencidos) {
        q = q.lt('validade', hojeISO);
      } else if (filtros.validade_dias != null) {
        const lim = new Date();
        lim.setDate(lim.getDate() + filtros.validade_dias);
        q = q.gte('validade', hojeISO).lte('validade', lim.toISOString().slice(0, 10));
      }

      // Faixas client-side filter via saldo ranges (simplified):
      if (filtros.faixas_saldo.length && !filtros.apenas_com_saldo) {
        const incluiSem = filtros.faixas_saldo.includes('sem_estoque');
        const incluiNeg = filtros.faixas_saldo.includes('negativo');
        const incluiCom = filtros.faixas_saldo.some((f) => f === 'baixo' || f === 'medio' || f === 'alto');
        if (incluiCom && !incluiSem && !incluiNeg) q = q.gt('saldo', 0);
        else if (!incluiCom && incluiSem && !incluiNeg) q = q.eq('saldo', 0);
        else if (!incluiCom && !incluiSem && incluiNeg) q = q.lt('saldo', 0);
      }

      q = q.order(sortBy, { ascending: sortDir === 'asc', nullsFirst: false });
      const from = page * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as EstoqueRow[], total: count ?? 0 };
    },
  });
}
