/**
 * Hook canônico para o domínio Contas a Pagar.
 *
 * Substitui as chamadas ad-hoc `useQuery + callApi` espalhadas pelas telas.
 * Centraliza listagem, consulta por id, criação/atualização (upsert),
 * lançamento de pagamento, cancelamento e estorno.
 *
 * Endpoints consumidos via `callApi("contas-pagar-api", { path, ... })`:
 *   GET    /query, /consultar, /pagamentos, /parcelas, /stats
 *   POST   /upsert, /lancar-pagamento, /cancelar, /estornar
 */
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { callApi } from "@/lib/utils/api-helpers";
import type {
  ContaPagar,
  Pagamento,
  Parcela,
  QueryParams,
  UpsertContaPagarInput,
  LancarPagamentoInput,
  EstornarInput,
  ApiResponse,
} from "@/types/financeiro/contas-pagar";

const FN = "contas-pagar-api";

// =====================================================
// Query keys (centralizadas para invalidations consistentes)
// =====================================================
export const contasPagarKeys = {
  all: ["contas-pagar"] as const,
  lists: () => [...contasPagarKeys.all, "list"] as const,
  list: (params: QueryParams) => [...contasPagarKeys.lists(), params] as const,
  details: () => [...contasPagarKeys.all, "detail"] as const,
  detail: (id: string) => [...contasPagarKeys.details(), id] as const,
  pagamentos: (contaPagarId: string) =>
    [...contasPagarKeys.all, "pagamentos", contaPagarId] as const,
  parcelas: (contaPagarId: string) =>
    [...contasPagarKeys.all, "parcelas", contaPagarId] as const,
};

// =====================================================
// Helpers
// =====================================================
function unwrapList<T>(res: ApiResponse<T[]> | T[] | null | undefined): T[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.rows)) return res.rows;
  return [];
}

function unwrapItem<T>(res: ApiResponse<T> | T | null | undefined): T | null {
  if (!res) return null;
  if (typeof res === "object" && res !== null && "data" in res) {
    return ((res as ApiResponse<T>).data as T) ?? null;
  }
  return (res as T) ?? null;
}

// =====================================================
// Queries
// =====================================================

/** Lista de contas a pagar (`/query`) com filtros opcionais. */
export function useContasPagarList(
  params: QueryParams = {},
  options?: Omit<UseQueryOptions<ContaPagar[]>, "queryKey" | "queryFn">,
) {
  return useQuery<ContaPagar[]>({
    queryKey: contasPagarKeys.list(params),
    queryFn: async () => {
      const res = await callApi(FN, { path: "/query", ...params });
      return unwrapList<ContaPagar>(res);
    },
    staleTime: 60_000,
    ...options,
  });
}

/** Consulta por id (`/consultar`). */
export function useContaPagarById(
  id: string | null | undefined,
  options?: Omit<UseQueryOptions<ContaPagar | null>, "queryKey" | "queryFn">,
) {
  return useQuery<ContaPagar | null>({
    queryKey: contasPagarKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) return null;
      const res = await callApi(FN, { path: "/consultar", id });
      return unwrapItem<ContaPagar>(res);
    },
    enabled: !!id,
    staleTime: 30_000,
    ...options,
  });
}

/** Pagamentos de um título (`/pagamentos`). */
export function usePagamentos(
  contaPagarId: string | null | undefined,
  options?: Omit<UseQueryOptions<Pagamento[]>, "queryKey" | "queryFn">,
) {
  return useQuery<Pagamento[]>({
    queryKey: contasPagarKeys.pagamentos(contaPagarId ?? ""),
    queryFn: async () => {
      if (!contaPagarId) return [];
      const res = await callApi(FN, {
        path: "/pagamentos",
        conta_pagar_id: contaPagarId,
      });
      return unwrapList<Pagamento>(res);
    },
    enabled: !!contaPagarId,
    staleTime: 30_000,
    ...options,
  });
}

/** Parcelas de um título (`/parcelas`). */
export function useParcelas(
  contaPagarId: string | null | undefined,
  options?: Omit<UseQueryOptions<Parcela[]>, "queryKey" | "queryFn">,
) {
  return useQuery<Parcela[]>({
    queryKey: contasPagarKeys.parcelas(contaPagarId ?? ""),
    queryFn: async () => {
      if (!contaPagarId) return [];
      const res = await callApi(FN, {
        path: "/parcelas",
        conta_pagar_id: contaPagarId,
      });
      return unwrapList<Parcela>(res);
    },
    enabled: !!contaPagarId,
    staleTime: 30_000,
    ...options,
  });
}

// =====================================================
// Mutations
// =====================================================

/** Cria/atualiza (`/upsert`) um título de contas a pagar. */
export function useUpsertContaPagar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertContaPagarInput) =>
      callApi(FN, { path: "/upsert", ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contasPagarKeys.lists() });
      qc.invalidateQueries({ queryKey: contasPagarKeys.details() });
    },
  });
}

/** Lança pagamento (`/lancar-pagamento`). */
export function useLancarPagamento(contaPagarId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LancarPagamentoInput) =>
      callApi(FN, { path: "/lancar-pagamento", ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contasPagarKeys.lists() });
      if (contaPagarId) {
        qc.invalidateQueries({ queryKey: contasPagarKeys.detail(contaPagarId) });
        qc.invalidateQueries({
          queryKey: contasPagarKeys.pagamentos(contaPagarId),
        });
      }
    },
  });
}

/** Cancela um título (`/cancelar`). */
export function useCancelarContaPagar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; motivo?: string }) =>
      callApi(FN, { path: "/cancelar", ...input }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: contasPagarKeys.lists() });
      qc.invalidateQueries({ queryKey: contasPagarKeys.detail(vars.id) });
    },
  });
}

/** Estorna um pagamento (`/estornar`). */
export function useEstornarPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EstornarInput) =>
      callApi(FN, { path: "/estornar", ...input }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: contasPagarKeys.lists() });
      qc.invalidateQueries({ queryKey: contasPagarKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: contasPagarKeys.pagamentos(vars.id) });
    },
  });
}

// =====================================================
// Façade agregada (estilo "useContasPagar()")
// =====================================================

/**
 * Atalho que expõe todas as operações em um único hook —
 * útil para telas que precisam de várias ações ao mesmo tempo.
 *
 * Para queries pontuais, prefira os hooks individuais (`useContasPagarList`,
 * `useContaPagarById`, etc.) para evitar acoplamento desnecessário.
 */
export function useContasPagar() {
  const upsert = useUpsertContaPagar();
  const pay = useLancarPagamento();
  const cancel = useCancelarContaPagar();
  const reverse = useEstornarPagamento();

  return {
    upsert,
    pay,
    cancel,
    reverse,
    keys: contasPagarKeys,
  };
}
