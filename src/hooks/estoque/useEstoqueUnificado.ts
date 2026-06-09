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
  // hidratado quando consolidado=true:
  filiais_count?: number;
  filiais?: Array<{ empresa: number; abrev: string | null; nome: string | null }>;
  filiais_rows?: EstoqueUnificadoRow[];
}

export interface UseEstoqueUnificadoOpts {
  empresaIds: number[];
  busca: string;
  somenteComSaldo: boolean;
  page: number;
  pageSize: number;
  sortBy: 'saldo_total_em_unidades' | 'custo_total' | 'saldo_em_caixas' | 'saldo_em_displays' | 'saldo_em_unidades';
  sortDir: 'asc' | 'desc';
  consolidar?: boolean;
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
      const consolidar = !!opts.consolidar;

      let q = supabase
        .from('vw_estoque_unificado' as any)
        .select('*', { count: 'estimated' });

      if (opts.empresaIds.length) q = q.in('empresa', opts.empresaIds);
      if (opts.somenteComSaldo) q = q.gt('saldo_total_em_unidades', 0);
      q = q.order(opts.sortBy, { ascending: opts.sortDir === 'asc', nullsFirst: false });

      if (!consolidar) {
        const from = opts.page * opts.pageSize;
        const to = from + opts.pageSize - 1;
        q = q.range(from, to);
      } else {
        // limite alto para cobrir o cache inteiro filtrado (≈3267 raízes × N filiais)
        q = q.range(0, 19999);
      }

      const { data, error, count } = await q;
      if (error) {
        logger.error('[useEstoqueUnificado] erro ao consultar vw_estoque_unificado', { error });
        throw error;
      }

      const rawRows = (data ?? []) as unknown as EstoqueUnificadoRow[];

      // Enriquecer com nomes do SKU raiz por (empresa, cod_produto).
      const codigos = Array.from(new Set(rawRows.map((r) => r.produto_raiz).filter(Boolean)));
      const empresas = Array.from(new Set(rawRows.map((r) => r.empresa).filter((v) => v != null)));
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

      let enriched = rawRows.map((r) => {
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

      if (!consolidar) {
        return { rows: enriched, total: count ?? 0 };
      }

      // -------- Modo consolidado: agrupa por produto_raiz --------
      // Chave normalizada como Number para evitar duplicatas se o PostgREST
      // devolver produto_raiz como string em alguma linha (defensivo).
      const groups = new Map<number, EstoqueUnificadoRow>();
      for (const r of enriched) {
        const k = Number(r.produto_raiz);
        if (!Number.isFinite(k)) {
          logger.warn('[useEstoqueUnificado] produto_raiz inválido — linha ignorada na consolidação', { row: r });
          continue;
        }
        const acc = groups.get(k);
        if (!acc) {
          groups.set(k, {
            ...r,
            produto_raiz: k,
            saldo_em_caixas: Number(r.saldo_em_caixas || 0),
            saldo_em_displays: Number(r.saldo_em_displays || 0),
            saldo_em_unidades: Number(r.saldo_em_unidades || 0),
            saldo_total_em_unidades: Number(r.saldo_total_em_unidades || 0),
            bloqueado_total_em_unidades: Number(r.bloqueado_total_em_unidades || 0),
            disponivel_total_em_unidades: Number(r.disponivel_total_em_unidades || 0),
            pendente_total_em_unidades: Number(r.pendente_total_em_unidades || 0),
            custo_total: Number(r.custo_total || 0),
            skus_envolvidos: Number(r.skus_envolvidos || 0),
            filiais_count: 1,
            filiais: [{ empresa: r.empresa, abrev: r.raiz_abrev ?? null, nome: r.raiz_nome ?? null }],
            filiais_rows: [r],
          });
        } else {
          acc.saldo_em_caixas += Number(r.saldo_em_caixas || 0);
          acc.saldo_em_displays += Number(r.saldo_em_displays || 0);
          acc.saldo_em_unidades += Number(r.saldo_em_unidades || 0);
          acc.saldo_total_em_unidades += Number(r.saldo_total_em_unidades || 0);
          acc.bloqueado_total_em_unidades += Number(r.bloqueado_total_em_unidades || 0);
          acc.disponivel_total_em_unidades += Number(r.disponivel_total_em_unidades || 0);
          acc.pendente_total_em_unidades += Number(r.pendente_total_em_unidades || 0);
          acc.custo_total += Number(r.custo_total || 0);
          acc.skus_envolvidos = Math.max(acc.skus_envolvidos, Number(r.skus_envolvidos || 0));
          acc.fator_cx_para_un = acc.fator_cx_para_un ?? r.fator_cx_para_un ?? null;
          acc.fator_bx_para_un = acc.fator_bx_para_un ?? r.fator_bx_para_un ?? null;
          acc.ean_raiz = acc.ean_raiz ?? r.ean_raiz ?? null;
          acc.raiz_nome = acc.raiz_nome ?? r.raiz_nome ?? null;
          acc.filiais_count = (acc.filiais_count ?? 0) + 1;
          acc.filiais!.push({ empresa: r.empresa, abrev: r.raiz_abrev ?? null, nome: r.raiz_nome ?? null });
          acc.filiais_rows!.push(r);
        }
      }

      const consolidated = Array.from(groups.values());

      // Ordena pelo mesmo sortBy/sortDir
      const dir = opts.sortDir === 'asc' ? 1 : -1;
      const key = opts.sortBy;
      consolidated.sort((a, b) => {
        const va = Number((a as any)[key] ?? 0);
        const vb = Number((b as any)[key] ?? 0);
        return (va - vb) * dir;
      });

      const totalGroups = consolidated.length;
      const from = opts.page * opts.pageSize;
      const pageRows = consolidated.slice(from, from + opts.pageSize);
      return { rows: pageRows, total: totalGroups };
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
