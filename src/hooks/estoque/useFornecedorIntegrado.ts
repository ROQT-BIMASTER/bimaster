import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SaldoEmpresa {
  cx: number;
  un: number;
}

export interface FornecedorIntegradoRow {
  empresa_id: number | null;
  empresa_nome: string | null;
  ean_caixa: string | null;
  ean_normalizado: string | null;
  futura_codigo: string | null;
  futura_descricao: string | null;
  fornecedor_caixas: number | null;
  futura_status: string | null;
  data_atualizacao_origem: string | null;
  sincronizado_em: string | null;
  nosso_codigo: string | null;
  sku: string | null;
  nome_comercial: string | null;
  categoria: string | null;
  origem_match: string | null;
  nosso_saldo_un: number | null;
  nosso_saldo_cx: number | null;
  saldos_por_empresa: Record<string, SaldoEmpresa> | null;
  casado: boolean | null;
}


export interface DistribuidoraEmpresa {
  id: number;
  nome: string;
  abrev: string;
}

function deriveAbrev(nome: string): string {
  const trimmed = nome.trim();
  if (trimmed.includes('-')) {
    const suf = trimmed.split('-').pop()?.trim() ?? '';
    const cleaned = suf.replace(/\(.*\)/g, '').trim();
    if (cleaned) return cleaned.toUpperCase().slice(0, 6);
  }
  return trimmed.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || String(trimmed);
}

/**
 * Lista de empresas (distribuidoras) usadas como colunas de saldo na
 * tela de Estoque do Fornecedor. Lê `dim_empresa` direto.
 */
export function useDistribuidorasEmpresas() {
  return useQuery({
    queryKey: ['distribuidoras-empresas-dim'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<DistribuidoraEmpresa[]> => {
      const { data, error } = await (supabase as any)
        .from('dim_empresa')
        .select('id_empresa, nome_empresa')
        .order('id_empresa', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as { id_empresa: number; nome_empresa: string | null }[])
        .map((r) => ({
          id: Number(r.id_empresa),
          nome: r.nome_empresa ?? `Empresa ${r.id_empresa}`,
          abrev: deriveAbrev(r.nome_empresa ?? `E${r.id_empresa}`),
        }));
    },
  });
}

export interface FornecedorIntegradoKpis {
  total: number;
  casados: number;
  pct_casado: number;
  com_saldo: number;
  com_saldo_casados: number;
  pct_casado_com_saldo: number;
  exceptions_pendentes: number;
}

/**
 * KPIs agregados a partir de v_estoque_fornecedor_integrado.
 * Faz duas queries com `head:true, count:exact` para evitar trafegar linhas.
 */
export function useFornecedorIntegradoKpis() {
  return useQuery({
    queryKey: ['fornecedor-integrado-kpis'],
    staleTime: 60_000,
    queryFn: async (): Promise<FornecedorIntegradoKpis> => {
      const tbl = 'v_estoque_fornecedor_integrado' as any;
      const [{ count: total }, { count: casados }, { count: comSaldo }, { count: comSaldoCasados }, { count: pendentes }] = await Promise.all([
        (supabase as any).from(tbl).select('*', { count: 'exact', head: true }),
        (supabase as any).from(tbl).select('*', { count: 'exact', head: true }).eq('casado', true),
        (supabase as any).from(tbl).select('*', { count: 'exact', head: true }).gt('fornecedor_caixas', 0),
        (supabase as any).from(tbl).select('*', { count: 'exact', head: true }).gt('fornecedor_caixas', 0).eq('casado', true),
        (supabase as any).from(tbl).select('*', { count: 'exact', head: true }).gt('fornecedor_caixas', 0).eq('casado', false),
      ]);
      const t = Number(total ?? 0);
      const c = Number(casados ?? 0);
      const cs = Number(comSaldo ?? 0);
      const csc = Number(comSaldoCasados ?? 0);
      return {
        total: t,
        casados: c,
        pct_casado: t ? Math.round((c / t) * 1000) / 10 : 0,
        com_saldo: cs,
        com_saldo_casados: csc,
        pct_casado_com_saldo: cs ? Math.round((csc / cs) * 1000) / 10 : 0,
        exceptions_pendentes: Number(pendentes ?? 0),
      };
    },
  });
}

export interface UseNaoCasadosOpts {
  busca: string;
  apenasComSaldo: boolean;
  page: number;
  pageSize: number;
}

export function useFornecedorNaoCasados(opts: UseNaoCasadosOpts) {
  return useQuery({
    queryKey: ['fornecedor-nao-casados', opts],
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      const from = opts.page * opts.pageSize;
      const to = from + opts.pageSize - 1;
      let q = (supabase as any)
        .from('v_estoque_fornecedor_integrado')
        .select('*', { count: 'exact' })
        .eq('casado', false);
      if (opts.apenasComSaldo) q = q.gt('fornecedor_caixas', 0);
      if (opts.busca.trim()) {
        const term = `%${opts.busca.trim()}%`;
        q = q.or(
          `futura_codigo.ilike.${term},ean_caixa.ilike.${term},futura_descricao.ilike.${term}`,
        );
      }
      q = q.order('fornecedor_caixas', { ascending: false, nullsFirst: false }).range(from, to);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as FornecedorIntegradoRow[], total: count ?? 0 };
    },
  });
}

export interface MasterSearchRow {
  codigo_rp: string | null;
  sku_master: string | null;
  nome: string | null;
  ean_caixa_master: string | null;
  ean_unitario_master: string | null;
}

export function useBuscarSkuMaster(termo: string) {
  return useQuery({
    queryKey: ['buscar-sku-master', termo],
    enabled: termo.trim().length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<MasterSearchRow[]> => {
      const term = `%${termo.trim()}%`;
      const { data, error } = await (supabase as any)
        .from('estoque_produtos_master')
        .select('codigo_rp, sku_master, nome, ean_caixa_master, ean_unitario_master')
        .or(
          `codigo_rp.ilike.${term},sku_master.ilike.${term},nome.ilike.${term},ean_caixa_master.ilike.${term},ean_unitario_master.ilike.${term}`,
        )
        .limit(20);
      if (error) throw error;
      return (data ?? []) as MasterSearchRow[];
    },
  });
}

export interface VincularDeparaInput {
  ean_fornecedor: string;
  codigo_rp: string | null;
  sku_master: string | null;
  nome_master: string | null;
  motivo?: string | null;
}

export function useVincularDepara() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: VincularDeparaInput) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from('fornecedor_ean_depara')
        .upsert(
          {
            ean_fornecedor: input.ean_fornecedor,
            codigo_rp: input.codigo_rp,
            sku_master: input.sku_master,
            nome_master: input.nome_master,
            origem: 'manual',
            motivo: input.motivo ?? null,
            criado_por: userRes.user?.id ?? null,
          },
          { onConflict: 'ean_fornecedor' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedor-nao-casados'] });
      qc.invalidateQueries({ queryKey: ['fornecedor-integrado-kpis'] });
    },
  });
}

// ============================================================================
// Tela de visualização do estoque do fornecedor (read-only)
// ============================================================================

export type CasadoFiltro = 'todos' | 'casados' | 'nao_casados';
export type FornecedorSortBy = 'fornecedor_caixas' | 'futura_descricao' | 'nosso_saldo_cx';

export interface UseFornecedorListOpts {
  busca: string;
  empresas: number[];
  casadoFiltro: CasadoFiltro;
  apenasComSaldo: boolean;
  status: string[];
  categorias: string[];
  dataDe: string | null;
  dataAte: string | null;
  sortBy: FornecedorSortBy;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export function useFornecedorIntegradoList(opts: UseFornecedorListOpts) {
  return useQuery({
    queryKey: ['fornecedor-integrado-list', opts],
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    queryFn: async () => {
      const from = opts.page * opts.pageSize;
      const to = from + opts.pageSize - 1;
      let q = (supabase as any)
        .from('v_estoque_fornecedor_integrado')
        .select('*', { count: 'exact' });

      if (opts.empresas.length) q = q.in('empresa_id', opts.empresas);
      if (opts.status.length) q = q.in('futura_status', opts.status);
      if (opts.categorias.length) q = q.in('categoria', opts.categorias);
      if (opts.dataDe) q = q.gte('data_atualizacao_origem', opts.dataDe);
      if (opts.dataAte) q = q.lte('data_atualizacao_origem', opts.dataAte);
      if (opts.casadoFiltro === 'casados') q = q.eq('casado', true);
      if (opts.casadoFiltro === 'nao_casados') q = q.eq('casado', false);
      if (opts.apenasComSaldo) q = q.gt('fornecedor_caixas', 0);
      if (opts.busca.trim()) {
        const term = `%${opts.busca.trim()}%`;
        q = q.or(
          `futura_descricao.ilike.${term},ean_caixa.ilike.${term},futura_codigo.ilike.${term},sku.ilike.${term},nome_comercial.ilike.${term}`,
        );
      }
      q = q.order(opts.sortBy, { ascending: opts.sortDir === 'asc', nullsFirst: false }).range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as FornecedorIntegradoRow[], total: count ?? 0 };
    },
  });
}

/** Listas distintas de status e categorias para popular filtros. */
export function useFornecedorFiltroOpcoes() {
  return useQuery({
    queryKey: ['fornecedor-integrado-filtro-opcoes'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_estoque_fornecedor_integrado')
        .select('futura_status, categoria')
        .range(0, 9999);
      if (error) throw error;
      const status = new Set<string>();
      const categorias = new Set<string>();
      for (const r of (data ?? []) as { futura_status: string | null; categoria: string | null }[]) {
        if (r.futura_status) status.add(r.futura_status);
        if (r.categoria) categorias.add(r.categoria);
      }
      return {
        status: Array.from(status).sort(),
        categorias: Array.from(categorias).sort(),
      };
    },
  });
}

/**
 * Empresas distintas existentes na view (lista pequena, ~3 valores).
 * Faz uma leitura limitada e deduplica no cliente — não há `distinct` no
 * client do Supabase.
 */
export function useEmpresasFornecedor() {
  return useQuery({
    queryKey: ['fornecedor-integrado-empresas'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_estoque_fornecedor_integrado')
        .select('empresa_id, empresa_nome')
        .not('empresa_id', 'is', null)
        .range(0, 9999);
      if (error) throw error;
      const map = new Map<number, string>();
      for (const r of (data ?? []) as { empresa_id: number; empresa_nome: string | null }[]) {
        if (!map.has(r.empresa_id)) map.set(r.empresa_id, r.empresa_nome ?? `Empresa ${r.empresa_id}`);
      }
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.id - b.id);
    },
  });
}

/** Soma de caixas no fornecedor (apenas itens com saldo > 0). */
export function useFornecedorTotalCaixas() {
  return useQuery({
    queryKey: ['fornecedor-integrado-total-caixas'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_estoque_fornecedor_integrado')
        .select('fornecedor_caixas')
        .gt('fornecedor_caixas', 0)
        .range(0, 9999);
      if (error) throw error;
      let s = 0;
      for (const r of (data ?? []) as { fornecedor_caixas: number | null }[]) {
        s += Number(r.fornecedor_caixas ?? 0);
      }
      return s;
    },
  });
}

export interface FornecedorKpisAvancados {
  disp_cx_total: number;
  disp_un_total: number;
  fornecedor_cx_total: number;
  cobertura_pct: number;
}

/** Somatórios globais usados nos KPIs avançados (somente itens casados). */
export function useFornecedorEstoqueKpisAvancados() {
  return useQuery({
    queryKey: ['fornecedor-integrado-kpis-avancados'],
    staleTime: 60_000,
    queryFn: async (): Promise<FornecedorKpisAvancados> => {
      const { data, error } = await (supabase as any)
        .from('v_estoque_fornecedor_integrado')
        .select('nosso_disponivel_cx, nosso_disponivel_un, fornecedor_caixas, casado')
        .eq('casado', true)
        .range(0, 9999);
      if (error) throw error;
      let dispCx = 0, dispUn = 0, fornCx = 0;
      for (const r of (data ?? []) as { nosso_disponivel_cx: number | null; nosso_disponivel_un: number | null; fornecedor_caixas: number | null }[]) {
        dispCx += Number(r.nosso_disponivel_cx ?? 0);
        dispUn += Number(r.nosso_disponivel_un ?? 0);
        fornCx += Number(r.fornecedor_caixas ?? 0);
      }
      return {
        disp_cx_total: dispCx,
        disp_un_total: dispUn,
        fornecedor_cx_total: fornCx,
        cobertura_pct: fornCx > 0 ? Math.round((dispCx / fornCx) * 1000) / 10 : 0,
      };
    },
  });
}


