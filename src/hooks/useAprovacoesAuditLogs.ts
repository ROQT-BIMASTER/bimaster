import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AprovacaoAuditLog {
  id: string;
  user_id: string | null;
  user_nome: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

/**
 * Lista logs de auditoria do módulo de Aprovações de Projetos.
 * Cobre mudanças de visão da inbox, ações da Central de Aprovações
 * e eventos dos fluxos de aprovação.
 */
export function useAprovacoesAuditLogs(params: {
  limit?: number;
  offset?: number;
  action?: string | null;
}) {
  const { user } = useAuth();
  const { limit = 100, offset = 0, action = null } = params;

  return useQuery({
    queryKey: ["aprovacoes-audit-logs", limit, offset, action],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_aprovacoes_audit_logs",
        { p_limit: limit, p_offset: offset, p_action: action },
      );
      if (error) throw error;
      return (data ?? []) as AprovacaoAuditLog[];
    },
  });
}
