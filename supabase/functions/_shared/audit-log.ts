// _shared/audit-log.ts — Audit log helper para operações sensíveis.
// Grava em `security_audit_log` usando as colunas existentes (action, severity,
// user_id, ip_address, user_agent, metadata). Campos extras (target, outcome,
// auth_source, empresa_id) vão dentro do JSONB `metadata` para evitar ALTER TABLE.
import { createClient } from "npm:@supabase/supabase-js@2";
import type { SecureContext } from "./secure-handler.ts";

export type AuditOutcome = "success" | "failure" | "denied";

export interface AuditLogEntry {
  /** Ação executada (ex: "user.password.reset", "data.export.bulk") */
  action: string;
  /** ID do recurso afetado (ex: user_id, empresa_id, file_id) */
  target_id?: string | null;
  /** Tipo do recurso afetado (ex: "user", "empresa", "boleto") */
  target_type?: string;
  /** Resultado da operação */
  outcome: AuditOutcome;
  /** Detalhes adicionais (não-sensíveis — sem senhas, tokens, etc.) */
  metadata?: Record<string, unknown>;
}

function deriveSeverity(outcome: AuditOutcome): string {
  return outcome === "success" ? "info" : "warning";
}

function extractIp(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

/**
 * Grava entrada de audit log em security_audit_log.
 * Fire-and-forget: nunca bloqueia o response do handler nem lança exceção.
 */
export async function logSensitiveOperation(
  ctx: SecureContext,
  req: Request,
  entry: AuditLogEntry,
): Promise<void> {
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await sb.from("security_audit_log").insert({
      user_id: ctx.userId ?? null,
      action: entry.action,
      severity: deriveSeverity(entry.outcome),
      ip_address: extractIp(req),
      user_agent: req.headers.get("user-agent") ?? null,
      metadata: {
        outcome: entry.outcome,
        target_id: entry.target_id ?? null,
        target_type: entry.target_type ?? null,
        empresa_id: ctx.empresaId ?? null,
        auth_source: ctx.authSource ?? null,
        ...(entry.metadata ?? {}),
      },
    });
  } catch (err) {
    console.error("[audit-log] failed to insert:", err);
  }
}
