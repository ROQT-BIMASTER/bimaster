// Hooks da Torre de Controle de Despesas (Fase 1).
// 3 RPCs agregadas (fn_despesas_departamentos/drill/variacoes) — chamada direta,
// sem fallback v1/v2 (padrão ContasAPagar.tsx:239-281, simplificado).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  TorreDepartamentosPayload,
  TorreDrillFornecedorPayload,
  TorreDrillNivel,
  TorreDrillPlanoPayload,
  TorreDrillTitulosPayload,
  TorreNatureza,
  TorreVariacoesPayload,
} from "@/types/financeiro/torre-despesas";

const STALE_TIME = 60_000;

/** Chave estável para arrays de empresas no queryKey */
const empresasKey = (ids: number[]) =>
  ids.length > 0 ? [...ids].sort((a, b) => a - b).join(",") : "all";

const empresasParam = (ids: number[]) => (ids.length > 0 ? ids : null);

// As RPCs da Torre ainda não existem nos tipos gerados do Supabase —
// o cast é o mesmo padrão usado em useSyncControlRubysp/callAggRpc.
async function callRpc<T>(fn: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, params as never);
  if (error) throw error;
  return data as unknown as T;
}

// ── fn_despesas_departamentos ────────────────────────────────────────────────

export interface UseTorreDepartamentosParams {
  meses?: number;
  /** YYYY-MM-DD ou null (mês corrente) */
  mesRef: string | null;
  empresaIds: number[];
  natureza: TorreNatureza;
  confMinima: number | null;
  incluirSemDepto?: boolean;
}

export function useTorreDepartamentos(params: UseTorreDepartamentosParams) {
  const meses = params.meses ?? 13;
  const incluirSemDepto = params.incluirSemDepto ?? true;
  return useQuery({
    queryKey: [
      "torre-despesas-departamentos",
      meses,
      params.mesRef ?? "atual",
      empresasKey(params.empresaIds),
      params.natureza ?? "todas",
      params.confMinima ?? "sem-corte",
      incluirSemDepto,
    ],
    queryFn: () =>
      callRpc<TorreDepartamentosPayload>("fn_despesas_departamentos", {
        p_meses: meses,
        p_mes_ref: params.mesRef,
        p_empresa_ids: empresasParam(params.empresaIds),
        p_natureza: params.natureza,
        p_conf_minima: params.confMinima,
        p_incluir_sem_depto: incluirSemDepto,
      }),
    staleTime: STALE_TIME,
  });
}

// ── fn_despesas_drill ────────────────────────────────────────────────────────

export interface UseTorreDrillParams {
  nivel: TorreDrillNivel;
  /** YYYY-MM-DD — obrigatório; sem mês o hook fica desabilitado */
  mes: string | null;
  departamentoId: string | null;
  semDepto: boolean;
  planoContasId: string | null;
  fornecedorCodigo: string | null;
  empresaIds: number[];
  natureza: TorreNatureza;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

type DrillPayloadFor<N extends TorreDrillNivel> = N extends "plano"
  ? TorreDrillPlanoPayload
  : N extends "fornecedor"
    ? TorreDrillFornecedorPayload
    : TorreDrillTitulosPayload;

export function useTorreDrill<N extends TorreDrillNivel>(
  params: UseTorreDrillParams & { nivel: N },
) {
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  return useQuery({
    queryKey: [
      "torre-despesas-drill",
      params.nivel,
      params.mes,
      params.departamentoId ?? (params.semDepto ? "sem-depto" : "todos"),
      params.planoContasId ?? "-",
      params.fornecedorCodigo ?? "-",
      empresasKey(params.empresaIds),
      params.natureza ?? "todas",
      limit,
      offset,
    ],
    // Drill só roda quando há uma seleção de mês vinda do heatmap
    enabled: (params.enabled ?? true) && !!params.mes,
    queryFn: () =>
      callRpc<DrillPayloadFor<N>>("fn_despesas_drill", {
        p_nivel: params.nivel,
        p_mes: params.mes,
        p_departamento: params.departamentoId,
        p_sem_depto: params.semDepto,
        p_plano_contas_id: params.planoContasId,
        p_fornecedor_codigo: params.fornecedorCodigo,
        p_empresa_ids: empresasParam(params.empresaIds),
        p_natureza: params.natureza,
        p_limit: limit,
        p_offset: offset,
      }),
    staleTime: STALE_TIME,
  });
}

// ── fn_despesas_variacoes ────────────────────────────────────────────────────

export interface UseTorreVariacoesParams {
  /** YYYY-MM-DD ou null (mês corrente) */
  mes: string | null;
  empresaIds: number[];
  natureza: TorreNatureza;
  minValor?: number;
  limit?: number;
}

export function useTorreVariacoes(params: UseTorreVariacoesParams) {
  const minValor = params.minValor ?? 5000;
  const limit = params.limit ?? 25;
  return useQuery({
    queryKey: [
      "torre-despesas-variacoes",
      params.mes ?? "atual",
      empresasKey(params.empresaIds),
      params.natureza ?? "todas",
      minValor,
      limit,
    ],
    queryFn: () =>
      callRpc<TorreVariacoesPayload>("fn_despesas_variacoes", {
        p_mes: params.mes,
        p_empresa_ids: empresasParam(params.empresaIds),
        p_natureza: params.natureza,
        p_min_valor: minValor,
        p_limit: limit,
      }),
    staleTime: STALE_TIME,
  });
}
