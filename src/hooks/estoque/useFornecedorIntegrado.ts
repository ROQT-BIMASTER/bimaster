import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  origem_match: string | null;
  nosso_saldo_un: number | null;
  nosso_saldo_cx: number | null;
  casado: boolean | null;
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
