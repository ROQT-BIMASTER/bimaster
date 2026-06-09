import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FilialSync {
  empresa: number;
  abrev: string | null;
  sincronizado_em: string | null;
  idade_horas: number | null;
}

export interface ValidacaoErpRow {
  produto_raiz: number;
  cache_saldo_em_caixas: number;
  cache_saldo_total_em_unidades: number;
  cache_bloqueado_total_em_unidades: number;
  cache_disponivel_total_em_unidades: number;
  cache_custo_total: number;
  erp_saldo_em_caixas: number;
  erp_saldo_total_em_unidades: number;
  erp_bloqueado_total_em_unidades: number;
  erp_disponivel_total_em_unidades: number;
  erp_custo_total: number;
  delta_saldo_total_em_unidades: number;
  delta_bloqueado_total_em_unidades: number;
  delta_disponivel_total_em_unidades: number;
  delta_custo_total: number;
  filiais_count: number;
  filiais_sync: FilialSync[];
  ultima_sync: string | null;
  filiais_defasadas: number;
}

/** Limiar de desvio relativo (0,5%) acima do qual a linha é marcada como divergente. */
export const VALIDACAO_THRESHOLD = 0.005;
/** Acima desse valor absoluto (UN) já consideramos discrepância material, mesmo com base zero. */
const ABS_QTY_THRESHOLD = 1;
const ABS_CUSTO_THRESHOLD = 0.5;

export type ValidacaoStatus = 'ok' | 'divergente' | 'defasado';

export interface ValidacaoResumo {
  status: ValidacaoStatus;
  rel_saldo: number;
  rel_bloqueado: number;
  rel_disponivel: number;
  rel_custo: number;
  /** Maior desvio relativo entre os 4 campos. */
  pior_desvio_rel: number;
}

function relDelta(delta: number, base: number, absThreshold: number): number {
  const a = Math.abs(delta);
  if (a < absThreshold) return 0;
  if (!base) return 1;
  return a / Math.abs(base);
}

export function resumirValidacao(r: ValidacaoErpRow): ValidacaoResumo {
  const rel_saldo = relDelta(r.delta_saldo_total_em_unidades, r.erp_saldo_total_em_unidades, ABS_QTY_THRESHOLD);
  const rel_bloqueado = relDelta(r.delta_bloqueado_total_em_unidades, r.erp_bloqueado_total_em_unidades, ABS_QTY_THRESHOLD);
  const rel_disponivel = relDelta(r.delta_disponivel_total_em_unidades, r.erp_disponivel_total_em_unidades, ABS_QTY_THRESHOLD);
  const rel_custo = relDelta(r.delta_custo_total, r.erp_custo_total, ABS_CUSTO_THRESHOLD);
  const pior = Math.max(rel_saldo, rel_bloqueado, rel_disponivel, rel_custo);
  let status: ValidacaoStatus = 'ok';
  if (pior > VALIDACAO_THRESHOLD) status = 'divergente';
  else if ((r.filiais_defasadas ?? 0) > 0) status = 'defasado';
  return { status, rel_saldo, rel_bloqueado, rel_disponivel, rel_custo, pior_desvio_rel: pior };
}

export function useEstoqueValidacaoErp(
  produtoRaizes: number[],
  empresas?: number[],
  enabled: boolean = true,
) {
  const raizesKey = useMemo(() => [...produtoRaizes].sort((a, b) => a - b), [produtoRaizes]);
  const empresasKey = useMemo(
    () => (empresas && empresas.length > 0 ? [...empresas].sort((a, b) => a - b) : null),
    [empresas],
  );

  return useQuery({
    queryKey: ['estoque-validacao-erp', raizesKey, empresasKey],
    enabled: enabled && raizesKey.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('estoque_validar_consolidado_erp', {
        p_produto_raizes: raizesKey,
        p_empresas: empresasKey,
      });
      if (error) throw error;
      const rows = ((data ?? []) as any[]).map(
        (r): ValidacaoErpRow => ({
          produto_raiz: Number(r.produto_raiz),
          cache_saldo_em_caixas: Number(r.cache_saldo_em_caixas ?? 0),
          cache_saldo_total_em_unidades: Number(r.cache_saldo_total_em_unidades ?? 0),
          cache_bloqueado_total_em_unidades: Number(r.cache_bloqueado_total_em_unidades ?? 0),
          cache_disponivel_total_em_unidades: Number(r.cache_disponivel_total_em_unidades ?? 0),
          cache_custo_total: Number(r.cache_custo_total ?? 0),
          erp_saldo_em_caixas: Number(r.erp_saldo_em_caixas ?? 0),
          erp_saldo_total_em_unidades: Number(r.erp_saldo_total_em_unidades ?? 0),
          erp_bloqueado_total_em_unidades: Number(r.erp_bloqueado_total_em_unidades ?? 0),
          erp_disponivel_total_em_unidades: Number(r.erp_disponivel_total_em_unidades ?? 0),
          erp_custo_total: Number(r.erp_custo_total ?? 0),
          delta_saldo_total_em_unidades: Number(r.delta_saldo_total_em_unidades ?? 0),
          delta_bloqueado_total_em_unidades: Number(r.delta_bloqueado_total_em_unidades ?? 0),
          delta_disponivel_total_em_unidades: Number(r.delta_disponivel_total_em_unidades ?? 0),
          delta_custo_total: Number(r.delta_custo_total ?? 0),
          filiais_count: Number(r.filiais_count ?? 0),
          filiais_sync: Array.isArray(r.filiais_sync)
            ? (r.filiais_sync as any[]).map((f) => ({
                empresa: Number(f.empresa),
                abrev: f.abrev ?? null,
                sincronizado_em: f.sincronizado_em ?? null,
                idade_horas: f.idade_horas == null ? null : Number(f.idade_horas),
              }))
            : [],
          ultima_sync: r.ultima_sync ?? null,
          filiais_defasadas: Number(r.filiais_defasadas ?? 0),
        }),
      );
      const map = new Map<number, ValidacaoErpRow>();
      for (const row of rows) map.set(row.produto_raiz, row);
      return map;
    },
  });
}
