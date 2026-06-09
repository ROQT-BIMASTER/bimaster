import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface EstoqueUnificadoRow {
  empresa: number;
  produto_raiz: number;
  saldo_em_caixas: number;
  saldo_em_displays: number;
  saldo_em_unidades: number;
  saldo_total_em_unidades: number;
  bloqueado_total_em_unidades: number;
  disponivel_total_em_unidades: number;
  pendente_total_em_unidades: number;
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
        logger.error('[useEstoqueUnificado] erro ao consultar vw_estoque_unificado', { error });
        throw error;
      }

      const rows = (data ?? []) as unknown as EstoqueUnificadoRow[];

      // Enriquecer com nomes do SKU raiz por (empresa, cod_produto).
      // ATENÇÃO: o mesmo cod_produto existe em várias filiais com abrev_par
      // diferente — chavear só por cod_produto faz uma filial herdar o nome
      // de outra (bug histórico: linha da empresa 11 aparecia como "RUBY ROSE - PR").
      const codigos = Array.from(new Set(rows.map((r) => r.produto_raiz).filter(Boolean)));
      const empresas = Array.from(new Set(rows.map((r) => r.empresa).filter((v) => v != null)));
      const nomes = new Map<string, { nome: string | null; abrev: string | null }>();
      if (codigos.length && empresas.length) {
        const { data: estData } = await supabase
          .from('erp_estoque_distribuidora')
          .select('empresa_par,cod_produto,nome_prod,abrev_par')
          .in('cod_produto', codigos)
          .in('empresa_par', empresas)
          .limit(codigos.length * empresas.length * 4);
        (estData ?? []).forEach((e: any) => {
          if (e.cod_produto == null || e.empresa_par == null) return;
          const key = `${e.empresa_par}|${e.cod_produto}`;
          if (!nomes.has(key)) {
            nomes.set(key, { nome: e.nome_prod, abrev: e.abrev_par });
          }
        });
      }

      let enriched = rows.map((r) => {
        const hit = nomes.get(`${r.empresa}|${r.produto_raiz}`);
        return {
          ...r,
          raiz_nome: hit?.nome ?? null,
          raiz_abrev: hit?.abrev ?? null,
        };
      });

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

export interface EstoqueUnificadoSkuRow {
  empresa: number;
  produto_raiz: number;
  cod_produto: number;
  nome_prod: string | null;
  abrev_par: string | null;
  codigo_barras_ean: string | null;
  nivel: number | null; // 1=CX, 2=BX, 3=UN
  pai_cod: number | null;
  fator_pai_para_filho: number | null;
  fator_un_acumulado: number;
  saldo: number;
  bloqueado: number;
  pendente: number;
  disponivel: number;
  custo_total: number;
  contribuicao_un: number;
  contribuicao_bloqueado_un: number;
  contribuicao_disponivel_un: number;
  contribuicao_pendente_un: number;
}

/**
 * Lista todos os SKUs (CX / BX / UN) que compõem um produto-raiz,
 * incluindo o fator aplicado e a contribuição em unidades equivalentes.
 * Permite ao usuário auditar item-a-item a memória de cálculo da linha-pai.
 */
export function useEstoqueUnificadoSkus(empresa: number | null, raiz: number | null) {
  return useQuery({
    queryKey: ['estoque-unificado-skus', empresa, raiz],
    enabled: empresa != null && raiz != null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_estoque_unificado_skus' as any)
        .select('*')
        .eq('empresa', empresa!)
        .eq('produto_raiz', raiz!);
      if (error) throw error;
      const rows = (data ?? []) as unknown as EstoqueUnificadoSkuRow[];
      // Ordena: nível asc (CX→BX→UN), depois pelo código
      return rows.sort((a, b) => {
        const na = a.nivel ?? 99;
        const nb = b.nivel ?? 99;
        if (na !== nb) return na - nb;
        return a.cod_produto - b.cod_produto;
      });
    },
  });
}
