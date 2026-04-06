import { supabase } from "@/integrations/supabase/client";

/**
 * Logs a client-side project access denial to security_audit_log.
 * Fire-and-forget — never blocks UI or throws.
 */
export async function logProjectAccessDenied(projetoId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("security_audit_log" as any).insert({
      action: "project_access_denied_client",
      severity: "medium",
      user_id: user.id,
      metadata: {
        projeto_id: projetoId,
        source: "frontend",
        url: window.location.href,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[AuditProjectAccess] Failed to log:", err);
  }
}
