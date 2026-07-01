import { supabase } from "@/integrations/supabase/client";

/**
 * Registra tentativas de leitura em recursos sensíveis (histórico de documentos,
 * transições de fluxo de aprovação, etc.) para trilha de auditoria e troubleshooting.
 *
 * Não bloqueia UI: falhas são silenciadas (apenas logadas em console em dev).
 */
export type RlsAccessOutcome = "granted" | "denied";

export interface LogRlsAccessInput {
  resourceType: string;
  resourceId?: string | null;
  outcome: RlsAccessOutcome;
  reason?: string | null;
  contexto?: Record<string, unknown>;
}

// Deduplica eventos idênticos por 30s para evitar flood em re-renders.
const recentLog = new Map<string, number>();
const DEDUPE_MS = 30_000;

export async function logRlsAccess(input: LogRlsAccessInput): Promise<void> {
  try {
    const key = `${input.resourceType}|${input.resourceId ?? ""}|${input.outcome}|${input.reason ?? ""}`;
    const now = Date.now();
    const prev = recentLog.get(key);
    if (prev && now - prev < DEDUPE_MS) return;
    recentLog.set(key, now);

    // Best-effort cleanup
    if (recentLog.size > 200) {
      for (const [k, ts] of recentLog) {
        if (now - ts > DEDUPE_MS) recentLog.delete(k);
      }
    }

    await supabase.rpc("rpc_log_rls_access", {
      _resource_type: input.resourceType,
      _resource_id: input.resourceId ?? null,
      _outcome: input.outcome,
      _reason: input.reason ?? null,
      _contexto: (input.contexto ?? {}) as any,
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[logRlsAccess] falhou (ignorado):", err);
    }
  }
}
