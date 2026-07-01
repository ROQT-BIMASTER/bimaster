import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toFriendlyPermissionMessage } from "@/lib/utils/permissionErrors";

export interface AccessRequestInput {
  resourceKind: string;
  resourceId?: string | null;
  resourceLabel?: string | null;
  route?: string | null;
  justification: string;
}

export interface AccessRequestRow {
  id: string;
  requester_id: string;
  requester_email: string | null;
  resource_kind: string;
  resource_id: string | null;
  resource_label: string | null;
  route: string | null;
  justification: string;
  status: "aberto" | "em_analise" | "aprovado" | "negado";
  handled_by: string | null;
  handled_at: string | null;
  handled_note: string | null;
  created_at: string;
  updated_at: string;
}

export function useCriarSolicitacaoAcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AccessRequestInput) => {
      const { data, error } = await supabase.rpc("rpc_criar_solicitacao_acesso", {
        p_resource_kind: input.resourceKind,
        p_resource_id: input.resourceId ?? null,
        p_resource_label: input.resourceLabel ?? null,
        p_route: input.route ?? (typeof window !== "undefined" ? window.location.pathname : null),
        p_justification: input.justification,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Solicitação enviada aos administradores");
      qc.invalidateQueries({ queryKey: ["access-requests"] });
    },
    onError: (e: any) =>
      toast.error(toFriendlyPermissionMessage(e, "Não foi possível registrar a solicitação")),
  });
}

export function useAccessRequests(scope: "mine" | "all" = "mine") {
  return useQuery({
    queryKey: ["access-requests", scope],
    queryFn: async () => {
      const q = supabase
        .from("access_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AccessRequestRow[];
    },
  });
}

export function useAtualizarSolicitacaoAcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: AccessRequestRow["status"]; note?: string }) => {
      const { error } = await supabase.rpc("rpc_atualizar_solicitacao_acesso", {
        p_id: input.id,
        p_status: input.status,
        p_note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Solicitação atualizada");
      qc.invalidateQueries({ queryKey: ["access-requests"] });
    },
    onError: (e: any) =>
      toast.error(toFriendlyPermissionMessage(e, "Falha ao atualizar solicitação")),
  });
}
