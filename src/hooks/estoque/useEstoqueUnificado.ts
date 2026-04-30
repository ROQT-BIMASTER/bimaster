import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EstoqueUnificadoRow {
  empresa: number;
  produto_raiz: number;
  saldo_em_caixas: number;
  saldo_em_displays: number;
  saldo_em_unidades: number;
  saldo_total_em_unidades: number;
  custo_total: number;
  skus_envolvidos: number;
  fator_cx_para_un: number | null;
  fator_bx_para_un: number | null;
  ean_raiz: string | null;
  // hidratado pelo enrich:
  raiz_nome?: string | null;
  raiz_abrev?: string | null;
}

export interface UseEstoqueUnificadoOpts {
  empresaIds: number[];
  busca: string;
  somenteComSaldo: boolean;
  page: number;
  pageSize: number;
  sortBy: 'saldo_total_em_unidades' | 'custo_total' | 'saldo_em_caixas' | 'saldo_em_displays' | 'saldo_em_unidades';
  sortDir: 'asc' | 'desc';
}

/**
 * Lista o estoque unificado em 3 níveis. A view `vw_estoque_unificado`
 * já agrega por (empresa, produto_raiz). Em seguida hidratamos os nomes
 * a partir de `erp_estoque_distribuidora`.
 */
export function useEstoqueUnificado(opts: UseEstoqueUnificadoOpts) {
  return useQuery({
    queryKey: ['estoque-unificado', opts],
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from('vw_estoque_unificado' as any)
        .select('*', { count: 'estimated' });

      if (opts.empresaIds.length) q = q.in('empresa', opts.empresaIds);
      if (opts.somenteComSaldo) q = q.gt('saldo_total_em_unidades', 0);
      q = q.order(opts.sortBy, { ascending: opts.sortDir === 'asc', nullsFirst: false });

      const from = opts.page * opts.pageSize;
      const to = from + opts.pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) {
        console.error('[useEstoqueUnificado] erro ao consultar vw_estoque_unificado', error);
        throw error;
      }

      const rows = (data ?? []) as unknown as EstoqueUnificadoRow[];

      // Enriquecer com nomes do SKU raiz
      const codigos = Array.from(new Set(rows.map((r) => r.produto_raiz).filter(Boolean)));
      let nomes: Record<number, { nome: string | null; abrev: string | null }> = {};
      if (codigos.length) {
        const { data: estData } = await supabase
          .from('erp_estoque_distribuidora')
          .select('cod_produto,nome_prod,abrev_par')
          .in('cod_produto', codigos)
          .limit(codigos.length * 5);
        (estData ?? []).forEach((e: any) => {
          if (e.cod_produto != null && !nomes[e.cod_produto]) {
            nomes[e.cod_produto] = { nome: e.nome_prod, abrev: e.abrev_par };
          }
        });
      }

      let enriched = rows.map((r) => ({
        ...r,
        raiz_nome: nomes[r.produto_raiz]?.nome ?? null,
        raiz_abrev: nomes[r.produto_raiz]?.abrev ?? null,
      }));

      if (opts.busca) {
        const b = opts.busca.toLowerCase();
        enriched = enriched.filter(
          (r) =>
            String(r.produto_raiz).includes(b) ||
            (r.raiz_nome ?? '').toLowerCase().includes(b),
        );
      }

      return { rows: enriched, total: count ?? 0 };
    },
  });
}

export interface BomPathRow {
  empresa: number;
  raiz_cod: number;
  folha_cod: number;
  fator_acumulado: number;
  profundidade: number;
  caminho: number[];
}

export function useBomPath(empresa: number | null, raizCod: number | null) {
  return useQuery({
    queryKey: ['bom-path', empresa, raizCod],
    enabled: empresa != null && raizCod != null,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_bom_path' as any)
        .select('*')
        .eq('empresa', empresa!)
        .eq('raiz_cod', raizCod!)
        .order('profundidade', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BomPathRow[];
    },
  });
}

export interface CapacidadeMontagemRow {
  empresa: number;
  raiz_cod: number;
  caixas_remontaveis: number;
  componentes_necessarios: number;
  componentes_em_falta: number;
}

export function useCapacidadeMontagem(empresa: number | null, raizCod: number | null) {
  return useQuery({
    queryKey: ['capacidade-montagem', empresa, raizCod],
    enabled: empresa != null && raizCod != null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_capacidade_montagem' as any)
        .select('*')
        .eq('empresa', empresa!)
        .eq('raiz_cod', raizCod!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as CapacidadeMontagemRow | null;
    },
  });
}
