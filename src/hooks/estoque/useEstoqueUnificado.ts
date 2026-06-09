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
  marca?: string | null;
  linha?: string | null;
  pedidos_count?: number;
  // nome oficial da filial (tabela `empresas`); fallback para abrev_par e por fim código
  filial_nome?: string | null;
  // hidratado quando consolidado=true:
  filiais_count?: number;
  filiais?: Array<{ empresa: number; abrev: string | null; nome: string | null; filial_nome: string | null }>;
  filiais_rows?: EstoqueUnificadoRow[];
}

export interface UseEstoqueUnificadoOpts {
  empresaIds: number[];
  busca: string;
  somenteComSaldo: boolean;
  page: number;
  pageSize: number;
  sortBy: 'saldo_total_em_unidades' | 'custo_total' | 'saldo_em_caixas' | 'saldo_em_displays' | 'saldo_em_unidades' | 'pedidos_count';
  sortDir: 'asc' | 'desc';
  consolidar?: boolean;
  marcas?: string[];
  linhas?: string[];
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
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const consolidar = !!opts.consolidar;

      let q = supabase
        .from('vw_estoque_unificado' as any)
        .select('*', { count: 'estimated' });

      if (opts.empresaIds.length) q = q.in('empresa', opts.empresaIds);
      if (opts.somenteComSaldo) q = q.gt('saldo_total_em_unidades', 0);
      q = q.order(opts.sortBy, { ascending: opts.sortDir === 'asc', nullsFirst: false });

      // Sempre carrega o dataset completo filtrado (cache pequeno) para que os
      // KPIs reflitam o total real, idêntico em ambos os modos. Paginação é client-side.
      q = q.range(0, 19999);

      const { data, error } = await q;

      if (error) {
        logger.error('[useEstoqueUnificado] erro ao consultar vw_estoque_unificado', { error });
        throw error;
      }

      const rawRows = (data ?? []) as unknown as EstoqueUnificadoRow[];

      // Enriquecer com nomes do SKU raiz.
      // - nome_prod: idêntico entre filiais → consultado apenas por cod_produto
      //   (evita produto cartesiano que estourava o teto implícito do PostgREST
      //   e fazia muitos produtos caírem no fallback "Produto N").
      // - abrev_par: varia por filial → consultado por (empresa, cod_produto).
      // Ambas as queries são paginadas em lotes para nunca depender de max_rows.
      const codigos = Array.from(new Set(rawRows.map((r) => r.produto_raiz).filter(Boolean)));
      const empresas = Array.from(new Set(rawRows.map((r) => r.empresa).filter((v) => v != null)));
      const nomesPorCod = new Map<number, string | null>();
      const abrevPorEmpresaCod = new Map<string, string | null>();
      const filialNomePorEmpresa = new Map<number, string | null>();

      const CHUNK = 500;
      const toChunks = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };

      // Nome da filial: `abrev_par` no ERP já é o nome correto da filial
      // (ex.: "RUBY ROSE-PE" para empresa 8). Como fallback, usamos
      // `dim_empresa.nome_empresa` (id numérico bate com `empresa_par`).
      // NÃO consultar `public.empresas` aqui — `empresas.id` é PK interna do
      // cadastro e não corresponde ao id ERP, gerando mismatch de nome.
      if (empresas.length) {
        const { data: dimData } = await supabase
          .from('dim_empresa')
          .select('id_empresa,nome_empresa')
          .in('id_empresa', empresas);
        (dimData ?? []).forEach((e: any) => {
          if (e?.id_empresa != null) filialNomePorEmpresa.set(Number(e.id_empresa), e.nome_empresa ?? null);
        });
      }


      if (codigos.length) {
        const codChunks = toChunks(codigos, CHUNK);

        const nomeResults = await Promise.all(
          codChunks.map((cs) =>
            supabase
              .from('erp_estoque_distribuidora')
              .select('cod_produto,nome_prod')
              .in('cod_produto', cs)
              .range(0, 19999),
          ),
        );
        nomeResults.forEach(({ data }) => {
          (data ?? []).forEach((e: any) => {
            if (e.cod_produto == null) return;
            if (!nomesPorCod.has(e.cod_produto) && e.nome_prod) {
              nomesPorCod.set(e.cod_produto, e.nome_prod);
            }
          });
        });

        if (empresas.length) {
          const abrevResults = await Promise.all(
            codChunks.map((cs) =>
              supabase
                .from('erp_estoque_distribuidora')
                .select('empresa_par,cod_produto,abrev_par')
                .in('cod_produto', cs)
                .in('empresa_par', empresas)
                .range(0, 19999),
            ),
          );
          abrevResults.forEach(({ data }) => {
            (data ?? []).forEach((e: any) => {
              if (e.cod_produto == null || e.empresa_par == null) return;
              const key = `${e.empresa_par}|${e.cod_produto}`;
              if (!abrevPorEmpresaCod.has(key)) {
                abrevPorEmpresaCod.set(key, e.abrev_par ?? null);
              }
            });
          });
        }
      }

      const resolveFilialNome = (empresaId: number, abrev: string | null | undefined): string | null => {
        // `dim_empresa.nome_empresa` é a fonte canônica editável do nome da filial.
        // `abrev_par` (ERP) é apenas fallback para empresas ainda não cadastradas.
        const oficial = filialNomePorEmpresa.get(Number(empresaId));
        if (oficial) return oficial;
        if (abrev) return abrev;
        return null;
      };


      let enriched = rawRows.map((r) => {
        const abrev = abrevPorEmpresaCod.get(`${r.empresa}|${r.produto_raiz}`) ?? null;
        return {
          ...r,
          raiz_nome: nomesPorCod.get(r.produto_raiz) ?? null,
          raiz_abrev: abrev,
          filial_nome: resolveFilialNome(r.empresa, abrev),
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

      // -------- Consolidação canônica (sempre executada) --------
      // Garante que os KPIs (aggregateRows) sejam idênticos em ambos os modos,
      // pois derivam SEMPRE do mesmo conjunto consolidado por produto_raiz.
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
            filiais: [{ empresa: r.empresa, abrev: r.raiz_abrev ?? null, nome: r.raiz_nome ?? null, filial_nome: r.filial_nome ?? null }],
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
          acc.filiais!.push({ empresa: r.empresa, abrev: r.raiz_abrev ?? null, nome: r.raiz_nome ?? null, filial_nome: r.filial_nome ?? null });
          acc.filiais_rows!.push(r);
        }
      }

      const consolidated = Array.from(groups.values());

      // Ordena ambas as listas pelo mesmo sortBy/sortDir
      const dir = opts.sortDir === 'asc' ? 1 : -1;
      const key = opts.sortBy;
      const sortFn = (a: EstoqueUnificadoRow, b: EstoqueUnificadoRow) => {
        const va = Number((a as any)[key] ?? 0);
        const vb = Number((b as any)[key] ?? 0);
        return (va - vb) * dir;
      };
      consolidated.sort(sortFn);
      enriched.sort(sortFn);

      // Display rows: consolidados ou por filial conforme toggle.
      // KPIs (aggregateRows) sempre derivam do conjunto consolidado canônico
      // para garantir totais idênticos nos dois modos.
      const displaySource = consolidar ? consolidated : enriched;
      const from = opts.page * opts.pageSize;
      const pageRows = displaySource.slice(from, from + opts.pageSize);
      return {
        rows: pageRows,
        total: displaySource.length,
        aggregateRows: consolidated,
      };

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
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
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
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: false,
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
