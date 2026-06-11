import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EstoqueMovimentoRow {
  id: string;
  empresa: number;
  tipo: 'desmontagem' | 'remontagem' | 'ajuste' | 'sync_erp';
  pai_cod: number | null;
  filho_cod: number | null;
  quantidade_pai: number | null;
  quantidade_filho: number | null;
  fator_bom: number | null;
  lote_origem: string | null;
  raiz_cod: number | null;
  motivo: string | null;
  unidades_equivalentes: number | null;
  executado_por: string | null;
  executado_em: string;
}

export function useEstoqueMovimentos(empresa: number | null, paiCod: number | null, limit = 30) {
  return useQuery({
    queryKey: ['estoque-movimentos', empresa, paiCod, limit],
    enabled: empresa != null && paiCod != null,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimento' as any)
        .select('*')
        .eq('empresa', empresa!)
        .eq('pai_cod', paiCod!)
        .order('executado_em', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as EstoqueMovimentoRow[];
    },
  });
}

export interface DriftRow {
  empresa: number;
  cod_produto: number;
  nome_prod: string | null;
  saldo_interno: number;
  saldo_erp: number;
  drift: number;
  drift_pct: number;
}

export function useDriftErp(empresaIds: number[]) {
  return useQuery({
    queryKey: ['drift-erp', empresaIds],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase.from('vw_drift_erp_unificado' as any).select('*').neq('drift', 0);
      if (empresaIds.length) q = q.in('empresa', empresaIds);
      q = q.order('drift_pct', { ascending: false }).limit(200);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DriftRow[];
    },
  });
}

export function useExecutarTransformacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tipo: 'desmontagem' | 'remontagem';
      empresa: number;
      pai_cod: number;
      quantidade: number;
      motivo?: string;
      lote_origem?: string | null;
    }) => {
      if (input.tipo === 'desmontagem') {
        const { data, error } = await supabase.rpc('executar_desmontagem' as any, {
          p_empresa: input.empresa,
          p_pai_cod: input.pai_cod,
          p_quantidade: input.quantidade,
          p_motivo: input.motivo ?? null,
          p_lote_origem: input.lote_origem ?? null,
        });
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.rpc('executar_remontagem' as any, {
        p_empresa: input.empresa,
        p_pai_cod: input.pai_cod,
        p_quantidade: input.quantidade,
        p_motivo: input.motivo ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-unificado'] });
      qc.invalidateQueries({ queryKey: ['estoque-movimentos'] });
      qc.invalidateQueries({ queryKey: ['drift-erp'] });
      qc.invalidateQueries({ queryKey: ['capacidade-montagem'] });
    },
  });
}
