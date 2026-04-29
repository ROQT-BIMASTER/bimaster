import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

/**
 * Registra mudanças de visão (escopo) da Caixa de Entrada em audit_logs.
 * Uso: const log = useInboxScopeAudit(); log({ from: "tudo", to: "produto", surface: "drawer" });
 *
 * O insert respeita a RLS de audit_logs (user_id = auth.uid()).
 */
export type InboxScopeChange = {
  from: string;
  to: string;
  surface: "drawer" | "central";
};

export function useInboxScopeAudit() {
  const { user } = useAuth();

  return useCallback(
    async (change: InboxScopeChange) => {
      if (!user || change.from === change.to) return;
      try {
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          action: "scope_changed",
          entity_type: "inbox_scope",
          old_data: { scope: change.from },
          new_data: { scope: change.to },
          metadata: {
            modulo: "projetos_aprovacoes",
            surface: change.surface,
          },
        });
      } catch (err) {
        // Log silencioso — falha de auditoria não pode quebrar a UX.
        // eslint-disable-next-line no-console
        logger.warn("[inbox-scope-audit] falha ao registrar:", err);
      }
    },
    [user],
  );
}
