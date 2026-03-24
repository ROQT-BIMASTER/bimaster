import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProcessDecision {
  id: string;
  process_id: string;
  submissao_id: string | null;
  origin: "brasil" | "china";
  destination: "brasil" | "china";
  decision_type: "approved" | "rejected" | "needs_revision";
  message: string;
  items_affected: Array<{ documento_id: string; label: string; motivo?: string }>;
  attachments: Array<{ url: string; nome: string }>;
  prazo_retorno: string | null;
  version: number;
  decided_by: string;
  decided_at: string;
  parent_decision_id: string | null;
  created_at: string;
}

export function useProcessDecisions(processId: string | undefined, submissaoId?: string) {
  const queryClient = useQueryClient();

  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ["process-decisions", processId, submissaoId],
    queryFn: async () => {
      let query = supabase
        .from("process_decisions" as any)
        .select("*")
        .order("version", { ascending: false });

      if (processId) {
        query = query.eq("process_id", processId);
      } else if (submissaoId) {
        query = query.eq("submissao_id", submissaoId);
      }

      const { data, error } = await (query as any);
      if (error) throw error;
      return (data || []) as ProcessDecision[];
    },
    enabled: !!(processId || submissaoId),
  });

  const createDecision = useMutation({
    mutationFn: async (params: {
      process_id: string;
      submissao_id?: string;
      origin: "brasil" | "china";
      destination: "brasil" | "china";
      decision_type: "approved" | "rejected" | "needs_revision";
      message: string;
      items_affected?: Array<{ documento_id: string; label: string; motivo?: string }>;
      attachments?: Array<{ url: string; nome: string }>;
      prazo_retorno?: string;
      parent_decision_id?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await (supabase
        .from("process_decisions" as any)
        .insert({
          process_id: params.process_id,
          submissao_id: params.submissao_id || null,
          origin: params.origin,
          destination: params.destination,
          decision_type: params.decision_type,
          message: params.message,
          items_affected: params.items_affected || [],
          attachments: params.attachments || [],
          prazo_retorno: params.prazo_retorno || null,
          parent_decision_id: params.parent_decision_id || null,
          decided_by: user.id,
        }) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-decisions"] });
    },
  });

  const latestDecision = decisions[0] || null;
  const pendingRevisions = decisions.filter(d => d.decision_type === "needs_revision" && d.destination === "china");

  return {
    decisions,
    isLoading,
    createDecision,
    latestDecision,
    pendingRevisions,
  };
}
