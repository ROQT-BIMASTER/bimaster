import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { intervaloMes } from "@/lib/quadra/resumoFinanceiro";
import type { LancamentoOutput } from "@/lib/validations/quadra";
import type { QuadraLancamento } from "@/types/quadra";

/** Tabelas do módulo ainda não constam nos tipos gerados do backend. */
const db = () => supabase as any;

export const QUADRA_LANCAMENTOS_KEY = ["quadra", "lancamentos"] as const;

export interface LancamentosFiltro {
  /** YYYY-MM — filtra por data de competência. */
  mes?: string;
  tipo?: "receita" | "despesa";
  status?: QuadraLancamento["status"];
}

export function useQuadraLancamentos(filtro: LancamentosFiltro = {}) {
  return useQuery({
    queryKey: [...QUADRA_LANCAMENTOS_KEY, filtro],
    queryFn: async (): Promise<QuadraLancamento[]> => {
      let q = db()
        .from("quadra_lancamentos")
        .select("*")
        .order("data_vencimento", { ascending: false })
        .order("created_at", { ascending: false });

      if (filtro.mes) {
        const { inicio, fim } = intervaloMes(filtro.mes);
        q = q.gte("data_competencia", inicio).lte("data_competencia", fim);
      }
      if (filtro.tipo) q = q.eq("tipo", filtro.tipo);
      if (filtro.status) q = q.eq("status", filtro.status);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(normalizar);
    },
  });
}

/** Lançamentos com competência entre `inicio` e `fim` (YYYY-MM-DD). Usado pelo painel. */
export function useQuadraLancamentosPeriodo(inicio: string, fim: string) {
  return useQuery({
    queryKey: [...QUADRA_LANCAMENTOS_KEY, "periodo", inicio, fim],
    queryFn: async (): Promise<QuadraLancamento[]> => {
      const { data, error } = await db()
        .from("quadra_lancamentos")
        .select("*")
        .gte("data_competencia", inicio)
        .lte("data_competencia", fim)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(normalizar);
    },
  });
}

function normalizar(row: any): QuadraLancamento {
  return { ...row, valor: Number(row.valor) };
}

function invalidarTudo(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["quadra"] });
}

export function useCriarLancamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LancamentoOutput) => {
      const { data, error } = await db()
        .from("quadra_lancamentos")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      invalidarTudo(queryClient);
      toast.success("Lançamento criado");
    },
    onError: (e: Error) => toast.error("Não foi possível criar o lançamento", { description: e.message }),
  });
}

export function useAtualizarLancamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<LancamentoOutput> & { id: string }) => {
      const { error } = await db().from("quadra_lancamentos").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo(queryClient);
      toast.success("Lançamento atualizado");
    },
    onError: (e: Error) => toast.error("Não foi possível atualizar o lançamento", { description: e.message }),
  });
}

/** Marca como pago/recebido na data informada (YYYY-MM-DD). */
export function useBaixarLancamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data_pagamento,
      forma_pagamento,
    }: {
      id: string;
      data_pagamento: string;
      forma_pagamento?: QuadraLancamento["forma_pagamento"];
    }) => {
      const { error } = await db()
        .from("quadra_lancamentos")
        .update({ status: "pago", data_pagamento, forma_pagamento: forma_pagamento ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo(queryClient);
      toast.success("Baixa registrada");
    },
    onError: (e: Error) => toast.error("Não foi possível registrar a baixa", { description: e.message }),
  });
}

export function useExcluirLancamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from("quadra_lancamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo(queryClient);
      toast.success("Lançamento excluído");
    },
    onError: (e: Error) => toast.error("Não foi possível excluir o lançamento", { description: e.message }),
  });
}

/** Gera as mensalidades pendentes dos mensalistas ativos para a competência (YYYY-MM). */
export function useGerarMensalidades() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mes: string): Promise<number> => {
      const { data, error } = await db().rpc("quadra_gerar_mensalidades", {
        p_competencia: `${mes}-01`,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (qtd) => {
      invalidarTudo(queryClient);
      if (qtd > 0) toast.success(`${qtd} mensalidade(s) gerada(s)`);
      else toast.info("Nenhuma mensalidade nova: todas já estavam geradas para o mês");
    },
    onError: (e: Error) => toast.error("Não foi possível gerar as mensalidades", { description: e.message }),
  });
}
