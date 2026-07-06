import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { extractOrcamentoError } from "@/lib/orcamento/errors";

export type SuplementacaoStatus = "pendente" | "aprovada" | "rejeitada";

export type SuplementacaoRow = {
  id: string;
  distribution_id: string;
  solicitante_id: string;
  valor: number;
  justificativa: string;
  alerta_id: string | null;
  status: SuplementacaoStatus;
  decisor_id: string | null;
  decidido_em: string | null;
  motivo_decisao: string | null;
  solicitado_em: string;
  // joined
  department_id: string | null;
  department_nome: string | null;
  period_id: string | null;
  solicitante_nome: string | null;
  decisor_nome: string | null;
};

export function useSuplementacoes(periodId: string | undefined) {
  return useQuery({
    queryKey: ["budget_suplementacoes", periodId],
    enabled: Boolean(periodId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_suplementacoes" as never)
        .select(
          `
          id, distribution_id, solicitante_id, valor, justificativa, alerta_id,
          status, decisor_id, decidido_em, motivo_decisao, solicitado_em,
          distribution:budget_distributions!inner(
            id, period_id, department_id,
            departamento:departamentos(id, nome)
          )
          `,
        )
        .eq("distribution.period_id" as never, periodId!)
        .order("solicitado_em", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as unknown as Array<{
        id: string;
        distribution_id: string;
        solicitante_id: string;
        valor: number | string;
        justificativa: string;
        alerta_id: string | null;
        status: SuplementacaoStatus;
        decisor_id: string | null;
        decidido_em: string | null;
        motivo_decisao: string | null;
        solicitado_em: string;
        distribution: {
          id: string;
          period_id: string;
          department_id: string | null;
          departamento: { id: string; nome: string } | null;
        } | null;
      }>;

      // Fetch nomes de usuários (solicitantes + decisores) em uma leva
      const uids = Array.from(
        new Set(
          rows.flatMap((r) => [r.solicitante_id, r.decisor_id].filter(Boolean) as string[]),
        ),
      );
      let nameMap: Record<string, string> = {};
      if (uids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", uids);
        (profs ?? []).forEach((p) => {
          nameMap[p.id] = (p as { full_name: string | null }).full_name || (p as { email: string | null }).email || p.id;
        });
      }

      return rows.map<SuplementacaoRow>((r) => ({
        id: r.id,
        distribution_id: r.distribution_id,
        solicitante_id: r.solicitante_id,
        valor: Number(r.valor ?? 0),
        justificativa: r.justificativa,
        alerta_id: r.alerta_id,
        status: r.status,
        decisor_id: r.decisor_id,
        decidido_em: r.decidido_em,
        motivo_decisao: r.motivo_decisao,
        solicitado_em: r.solicitado_em,
        department_id: r.distribution?.department_id ?? null,
        department_nome: r.distribution?.departamento?.nome ?? null,
        period_id: r.distribution?.period_id ?? null,
        solicitante_nome: nameMap[r.solicitante_id] ?? null,
        decisor_nome: r.decisor_id ? nameMap[r.decisor_id] ?? null : null,
      }));
    },
  });
}

export function useSolicitarSuplementacao(periodId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      distribution_id: string;
      valor: number;
      justificativa: string;
      alerta_id?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("rpc_solicitar_suplementacao" as never, {
        p_distribution_id: input.distribution_id,
        p_valor: input.valor,
        p_justificativa: input.justificativa,
        p_alerta_id: input.alerta_id ?? null,
      } as never);
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget_suplementacoes", periodId] });
      toast.success("Suplementação solicitada");
    },
    onError: (e) => {
      toast.error(extractOrcamentoError(e, "Falha ao solicitar suplementação"));
    },
  });
}

export function useDecidirSuplementacao(periodId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; aprovar: boolean; motivo?: string | null }) => {
      const { error } = await supabase.rpc("rpc_decidir_suplementacao" as never, {
        p_id: input.id,
        p_aprovar: input.aprovar,
        p_motivo: input.motivo ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["budget_suplementacoes", periodId] });
      qc.invalidateQueries({ queryKey: ["orcamento_consumo", periodId] });
      qc.invalidateQueries({ queryKey: ["budget_distributions", periodId] });
      qc.invalidateQueries({ queryKey: ["budget_distribution_kpis"] });
      toast.success(vars.aprovar ? "Suplementação aprovada" : "Suplementação rejeitada");
    },
    onError: (e) => {
      toast.error(extractOrcamentoError(e, "Falha ao decidir suplementação"));
    },
  });
}
