import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { awaitCacheUnificadoFresh } from '@/lib/estoque/cacheFreshness';

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
  /** Nome canônico do produto-raiz já resolvido no backend (cache do unificado). */
  nome_raiz?: string | null;
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
  /** produto_raiz permitidos quando há filtro de campanha ativo; null/undefined = sem filtro. */
  campanhaProdutos?: number[] | null;
}

/**
 * Lista o estoque unificado em 3 níveis. A view `vw_estoque_unificado`
 * já agrega por (empresa, produto_raiz). Em seguida hidratamos os nomes
 * a partir de `erp_estoque_distribuidora`.
 */
export function useEstoqueUnificado(opts: UseEstoqueUnificadoOpts) {
  // Normaliza a queryKey para que arrays fora de ordem (empresaIds/marcas/linhas)
  // ou espaços em branco na busca não disfarcem mudanças reais e tampouco causem
  // cache miss desnecessário.
  const normalizedKey = {
    empresaIds: [...opts.empresaIds].sort((a, b) => a - b),
    busca: (opts.busca ?? '').trim().toLowerCase(),
    somenteComSaldo: !!opts.somenteComSaldo,
    page: opts.page,
    pageSize: opts.pageSize,
    sortBy: opts.sortBy,
    sortDir: opts.sortDir,
    consolidar: !!opts.consolidar,
    marcas: [...(opts.marcas ?? [])].sort(),
    linhas: [...(opts.linhas ?? [])].sort(),
    campanhaProdutos: opts.campanhaProdutos == null ? null : [...opts.campanhaProdutos].sort((a, b) => a - b),
  };
  return useQuery({
    queryKey: ['estoque-unificado', normalizedKey],
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      // Garante que o cache unificado está fresco antes de ler — singleton
      // compartilhado com useEstoqueCoresKpis e ConciliacaoBadge.
      await awaitCacheUnificadoFresh();

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
      const linhaPorCod = new Map<number, string | null>();
      const marcaPorCod = new Map<number, string | null>();
      const pedidosPorEmpresaCod = new Map<string, Set<string | number>>();

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
              .select('cod_produto,nome_prod,nome_linha')
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
            if (!linhaPorCod.has(e.cod_produto) && e.nome_linha) {
              linhaPorCod.set(e.cod_produto, e.nome_linha);
            }
          });
        });

        // Fallback em cascata para nomes ausentes (ex.: raiz sem linha física
        // na empresa filtrada, ou tipo divergente). Roda só para os faltantes.
        const faltantes = codigos.filter((c) => !nomesPorCod.get(c));
        if (faltantes.length) {
          const faltChunks = toChunks(faltantes, CHUNK);

          // 1) vw_estoque_unificado_skus (nivel=1) — tem nome_prod independente da filial
          try {
            const skuResults = await Promise.all(
              faltChunks.map((cs) =>
                supabase
                  .from('vw_estoque_unificado_skus' as any)
                  .select('cod_produto,nome_prod')
                  .in('cod_produto', cs)
                  .eq('nivel', 1)
                  .range(0, 19999),
              ),
            );
            skuResults.forEach(({ data }) => {
              (data ?? []).forEach((e: any) => {
                if (e?.cod_produto != null && e.nome_prod && !nomesPorCod.has(e.cod_produto)) {
                  nomesPorCod.set(e.cod_produto, e.nome_prod);
                }
              });
            });
          } catch (e) {
            logger.warn('[useEstoqueUnificado] fallback skus view falhou', { error: e });
          }

          // 2) fabrica_produtos por codigo_erp / sku
          const aindaFaltam = codigos.filter((c) => !nomesPorCod.get(c));
          if (aindaFaltam.length) {
            try {
              const codStr = aindaFaltam.map((c) => String(c));
              const codStrChunks = toChunks(codStr, CHUNK);
              const fpResults = await Promise.all(
                codStrChunks.map((cs) =>
                  supabase
                    .from('fabrica_produtos')
                    .select('codigo_erp,sku,nome,nome_comercial')
                    .or(`codigo_erp.in.(${cs.join(',')}),sku.in.(${cs.join(',')})`)
                    .range(0, 19999),
                ),
              );
              fpResults.forEach(({ data }) => {
                (data ?? []).forEach((e: any) => {
                  const nome = e?.nome_comercial || e?.nome;
                  if (!nome) return;
                  const candidates = [e?.codigo_erp, e?.sku].filter((v) => v != null);
                  candidates.forEach((v) => {
                    const cod = Number(v);
                    if (Number.isFinite(cod) && !nomesPorCod.has(cod)) {
                      nomesPorCod.set(cod, nome);
                    }
                  });
                });
              });
            } catch (e) {
              logger.warn('[useEstoqueUnificado] fallback fabrica_produtos falhou', { error: e });
            }
          }

          if (import.meta.env.DEV) {
            const semNome = codigos.filter((c) => !nomesPorCod.get(c));
            if (semNome.length) {
              logger.warn('[useEstoqueUnificado] raízes sem nome após fallbacks', { codigos: semNome.slice(0, 20), total: semNome.length });
            }
          }
        }

        // Marca + nome (fallback) por SKU — catálogo rr_produtos (sku == cod_produto)
        const marcaResults = await Promise.all(
          codChunks.map((cs) =>
            supabase
              .from('rr_produtos')
              .select('sku,marca,nome_comercial')
              .in('sku', cs as any)
              .range(0, 19999),
          ),
        );
        marcaResults.forEach(({ data }) => {
          (data ?? []).forEach((e: any) => {
            const cod = Number(e?.sku);
            if (!Number.isFinite(cod)) return;
            if (!marcaPorCod.has(cod) && e.marca) {
              marcaPorCod.set(cod, String(e.marca));
            }
            // rr_produtos.nome_comercial entra como fallback antes do "Produto N"
            const nomeRR = typeof e?.nome_comercial === 'string' ? e.nome_comercial.trim() : '';
            if (nomeRR && !nomesPorCod.get(cod)) {
              nomesPorCod.set(cod, nomeRR);
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

          // Pedidos abertos: 2 passos para evitar embed pesado.
          // 1) Lista de pedidos abertos das empresas em jogo.
          // 2) Itens desses pedidos cujo produto_codigo casa com algum cod_produto.
          try {
            const STATUS_ABERTOS = ['aberto', 'aguardando', 'aprovado', 'em_separacao', 'em_separação', 'pendente', 'novo'];
            const { data: pedidosData } = await supabase
              .from('oms_pedidos')
              .select('id,empresa_id,status')
              .in('empresa_id', empresas)
              .in('status', STATUS_ABERTOS)
              .range(0, 19999);
            const pedidoEmpresa = new Map<string, number>();
            const pedidoIds: string[] = [];
            (pedidosData ?? []).forEach((p: any) => {
              if (!p?.id) return;
              pedidoEmpresa.set(String(p.id), Number(p.empresa_id));
              pedidoIds.push(String(p.id));
            });

            if (pedidoIds.length) {
              const pedidoChunks = toChunks(pedidoIds, CHUNK);
              const codigosStr = codigos.map((c) => String(c));
              const itensResults = await Promise.all(
                pedidoChunks.map((ps) =>
                  supabase
                    .from('oms_pedido_itens')
                    .select('pedido_id,produto_codigo')
                    .in('pedido_id', ps)
                    .in('produto_codigo', codigosStr)
                    .range(0, 49999),
                ),
              );
              itensResults.forEach(({ data }) => {
                (data ?? []).forEach((it: any) => {
                  const empresaId = pedidoEmpresa.get(String(it.pedido_id));
                  const cod = Number(it.produto_codigo);
                  if (!Number.isFinite(cod) || empresaId == null) return;
                  const key = `${empresaId}|${cod}`;
                  let set = pedidosPorEmpresaCod.get(key);
                  if (!set) {
                    set = new Set();
                    pedidosPorEmpresaCod.set(key, set);
                  }
                  set.add(String(it.pedido_id));
                });
              });
            }
          } catch (e) {
            logger.warn('[useEstoqueUnificado] falha ao hidratar pedidos abertos', { error: e });
          }
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
        const pedSet = pedidosPorEmpresaCod.get(`${r.empresa}|${r.produto_raiz}`);
        return {
          ...r,
          // Prioridade: nome canônico do cache (vw_estoque_unificado.nome_raiz),
          // depois nomes derivados via enrich (erp_estoque_distribuidora,
          // vw_estoque_unificado_skus, fabrica_produtos, rr_produtos). Após o
          // backfill de nome_raiz no cache, o cliente raramente cai nos fallbacks.
          raiz_nome: (r.nome_raiz && r.nome_raiz.trim()) || nomesPorCod.get(r.produto_raiz) || null,
          raiz_abrev: abrev,
          filial_nome: resolveFilialNome(r.empresa, abrev),
          marca: marcaPorCod.get(r.produto_raiz) ?? null,
          linha: linhaPorCod.get(r.produto_raiz) ?? null,
          pedidos_count: pedSet ? pedSet.size : 0,
        };
      });

      // Busca endurecida: trim, mínimo 2 chars; código numérico exige match exato
      // (evita "55" puxar 9558). Texto pesquisa em nome, marca e linha.
      const rawBusca = (opts.busca ?? '').trim().toLowerCase();
      if (rawBusca.length >= 2) {
        const isNumeric = /^\d+$/.test(rawBusca);
        enriched = enriched.filter((r) =>
          isNumeric
            ? String(r.produto_raiz) === rawBusca
            : (r.raiz_nome ?? '').toLowerCase().includes(rawBusca)
              || (r.marca ?? '').toLowerCase().includes(rawBusca)
              || (r.linha ?? '').toLowerCase().includes(rawBusca),
        );
      }

      if (opts.marcas && opts.marcas.length) {
        const set = new Set(opts.marcas.map((m) => m.toLowerCase()));
        enriched = enriched.filter((r) => r.marca && set.has(String(r.marca).toLowerCase()));
      }
      if (opts.linhas && opts.linhas.length) {
        const set = new Set(opts.linhas.map((m) => m.toLowerCase()));
        enriched = enriched.filter((r) => r.linha && set.has(String(r.linha).toLowerCase()));
      }
      if (opts.campanhaProdutos != null) {
        const set = new Set(opts.campanhaProdutos.map((n) => Number(n)));
        enriched = enriched.filter((r) => set.has(Number(r.produto_raiz)));
      }

      // Filtro defensivo client-side de "Apenas com saldo": espelha o filtro
      // server-side e impede que linhas com saldo 0 vazem por cache stale.
      if (opts.somenteComSaldo) {
        enriched = enriched.filter((r) => Number(r.saldo_total_em_unidades || 0) > 0);
      }

      // -------- Consolidação canônica (sempre executada) --------
      // Garante que os KPIs (aggregateRows) sejam idênticos em ambos os modos,
      // pois derivam SEMPRE do mesmo conjunto consolidado por produto_raiz.
      const groups = new Map<number, EstoqueUnificadoRow>();
      for (const r of enriched) {
        // Fallback: se produto_raiz vier nulo/não numérico, consolida pelo próprio
        // cod_produto para NÃO perder saldo no total. Loga para investigação, mas
        // a linha continua somando — garante paridade com SUM(vw_estoque_unificado).
        const rawK = Number(r.produto_raiz);
        const k = Number.isFinite(rawK) ? rawK : Number((r as any).cod_produto);
        if (!Number.isFinite(k)) {
          logger.warn('[useEstoqueUnificado] produto_raiz e cod_produto inválidos — linha ignorada', { row: r });
          continue;
        }
        if (!Number.isFinite(rawK)) {
          logger.warn('[useEstoqueUnificado] produto_raiz inválido — consolidando por cod_produto', { row: r });
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
            pedidos_count: Number(r.pedidos_count || 0),
            marca: r.marca ?? null,
            linha: r.linha ?? null,
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
          acc.pedidos_count = Number(acc.pedidos_count || 0) + Number(r.pedidos_count || 0);
          // Prefere o primeiro valor não-nulo encontrado; loga divergência
          // entre filiais do mesmo produto-raiz (sinaliza lookup sujo).
          if (r.marca && acc.marca && r.marca !== acc.marca) {
            logger.warn('[useEstoqueUnificado] marca divergente entre filiais', {
              produto_raiz: k, marca_a: acc.marca, marca_b: r.marca,
            });
          }
          if (r.linha && acc.linha && r.linha !== acc.linha) {
            logger.warn('[useEstoqueUnificado] linha divergente entre filiais', {
              produto_raiz: k, linha_a: acc.linha, linha_b: r.linha,
            });
          }
          acc.marca = acc.marca ?? r.marca ?? null;
          acc.linha = acc.linha ?? r.linha ?? null;
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

      // Diagnóstico: rastreia produto-raiz "watch" (cód. 9558) quando aparece
      // após qualquer filtro ativo, para auditoria de leak de filtro.
      if (import.meta.env.DEV) {
        const WATCH = new Set<number>([9558]);
        const hits = displaySource.filter((r) => WATCH.has(Number(r.produto_raiz)));
        if (hits.length) {
          // eslint-disable-next-line no-console
          console.debug('[useEstoqueUnificado] watch hit', {
            filtros: {
              empresaIds: opts.empresaIds,
              busca: opts.busca,
              marcas: opts.marcas,
              linhas: opts.linhas,
              somenteComSaldo: opts.somenteComSaldo,
              consolidar,
            },
            hits: hits.map((r) => ({
              empresa: r.empresa,
              produto_raiz: r.produto_raiz,
              marca: r.marca,
              linha: r.linha,
              raiz_nome: r.raiz_nome,
              saldo_total_em_unidades: r.saldo_total_em_unidades,
              filiais_count: r.filiais_count,
            })),
          });
        }
      }

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
    refetchInterval: 30_000,
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
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const [viewRes, complRes] = await Promise.all([
        supabase
          .from('vw_estoque_unificado_skus' as any)
          .select('*')
          .eq('empresa', empresa!)
          .eq('produto_raiz', raiz!),
        supabase.rpc('estoque_unificado_bom_complemento' as any, {
          p_empresa: empresa!,
          p_raiz: raiz!,
        } as any),
      ]);

      if (viewRes.error) throw viewRes.error;

      // Normaliza chaves numéricas para evitar colisão string vs number entre view e RPC
      const norm = (r: any): EstoqueUnificadoSkuRow => ({
        ...r,
        cod_produto: Number(r.cod_produto),
        pai_cod: r.pai_cod == null ? null : Number(r.pai_cod),
        produto_raiz: Number(r.produto_raiz),
        nivel: r.nivel == null ? null : Number(r.nivel),
      });

      const baseRows = ((viewRes.data ?? []) as any[]).map(norm) as EstoqueUnificadoSkuRow[];

      let complementoData: EstoqueUnificadoSkuRow[] = [];
      if (!complRes.error && Array.isArray(complRes.data)) {
        complementoData = (complRes.data as any[]).map(norm);
      }
      const presentes = new Set<number>(baseRows.map((r) => r.cod_produto));
      const complementoRows = complementoData.filter((r) => !presentes.has(r.cod_produto));

      const rows = baseRows.concat(complementoRows);

      // Hidratação de nomes: complemento -> outros registros do merge -> ERP cross-empresa
      // -> fabrica_produtos -> rr_produtos.nome_comercial.
      const nomePorCod = new Map<number, string>();
      complementoData.forEach((r) => {
        if (r.nome_prod && !nomePorCod.has(r.cod_produto)) nomePorCod.set(r.cod_produto, r.nome_prod);
      });
      rows.forEach((r) => {
        if (r.nome_prod && !nomePorCod.has(r.cod_produto)) nomePorCod.set(r.cod_produto, r.nome_prod);
      });
      const isGenerico = (n: string | null | undefined, cod: number) =>
        !n || n.trim() === '' || n.trim().toLowerCase() === `produto ${cod}`;
      const semNome = Array.from(new Set(rows.filter((r) => isGenerico(r.nome_prod, r.cod_produto) && !nomePorCod.has(r.cod_produto)).map((r) => r.cod_produto)));
      if (semNome.length) {
        try {
          const { data } = await supabase
            .from('erp_estoque_distribuidora')
            .select('cod_produto,nome_prod')
            .in('cod_produto', semNome)
            .range(0, 19999);
          (data ?? []).forEach((e: any) => {
            const cod = Number(e?.cod_produto);
            if (Number.isFinite(cod) && e.nome_prod && !nomePorCod.has(cod)) {
              nomePorCod.set(cod, e.nome_prod);
            }
          });
        } catch (e) {
          logger.warn('[useEstoqueUnificadoSkus] fallback erp nome falhou', { error: e });
        }
        const aindaSem = semNome.filter((c) => !nomePorCod.has(c));
        if (aindaSem.length) {
          try {
            const codStr = aindaSem.map((c) => String(c));
            const { data } = await supabase
              .from('fabrica_produtos')
              .select('codigo_erp,sku,nome,nome_comercial')
              .or(`codigo_erp.in.(${codStr.join(',')}),sku.in.(${codStr.join(',')})`)
              .range(0, 19999);
            (data ?? []).forEach((e: any) => {
              const nome = e?.nome_comercial || e?.nome;
              if (!nome) return;
              [e?.codigo_erp, e?.sku].forEach((v) => {
                const cod = Number(v);
                if (Number.isFinite(cod) && !nomePorCod.has(cod)) nomePorCod.set(cod, nome);
              });
            });
          } catch (e) {
            logger.warn('[useEstoqueUnificadoSkus] fallback fabrica nome falhou', { error: e });
          }
        }
        const aindaSem2 = semNome.filter((c) => !nomePorCod.has(c));
        if (aindaSem2.length) {
          try {
            const codStr = aindaSem2.map((c) => String(c));
            const { data } = await supabase
              .from('rr_produtos')
              .select('sku,nome_comercial')
              .in('sku', codStr)
              .range(0, 19999);
            (data ?? []).forEach((e: any) => {
              const cod = Number(e?.sku);
              const nome = typeof e?.nome_comercial === 'string' ? e.nome_comercial.trim() : '';
              if (Number.isFinite(cod) && nome && !nomePorCod.has(cod)) {
                nomePorCod.set(cod, nome);
              }
            });
          } catch (e) {
            logger.warn('[useEstoqueUnificadoSkus] fallback rr_produtos nome falhou', { error: e });
          }
        }
      }
      const hidratadas = rows.map((r) => {
        const cur = r.nome_prod;
        if (cur && cur.trim() !== '' && cur.trim().toLowerCase() !== `produto ${r.cod_produto}`) return r;
        return { ...r, nome_prod: nomePorCod.get(r.cod_produto) ?? null };
      });

      return hidratadas.sort((a, b) => {
        const na = a.nivel ?? 99;
        const nb = b.nivel ?? 99;
        if (na !== nb) return na - nb;
        return a.cod_produto - b.cod_produto;
      });

    },
  });
}
