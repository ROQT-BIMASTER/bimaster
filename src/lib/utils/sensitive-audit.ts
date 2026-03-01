/**
 * Centralized audit logging for sensitive operations.
 * Uses the existing `audit_logs` table for all sensitive action tracking.
 * 
 * Categories:
 * - EXPORT: Financial data exports (Excel, CSV, PDF)
 * - ADMIN: User creation, permission changes, password resets
 * - SHARE: Document sharing via tokens
 * - ACCESS: Sensitive data access (financial reports, PII views)
 */
import { supabase } from "@/integrations/supabase/client";

export type AuditCategory = "EXPORT" | "ADMIN" | "SHARE" | "ACCESS";

export interface SensitiveAuditEntry {
  action: string;
  category: AuditCategory;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs a sensitive operation to the audit_logs table.
 * Fire-and-forget: never blocks the UI or throws.
 */
export async function auditSensitiveAction(entry: SensitiveAuditEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: `${entry.category}:${entry.action}`,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      metadata: {
        category: entry.category,
        ...entry.metadata,
        timestamp: new Date().toISOString(),
      },
      user_agent: navigator.userAgent,
    });
  } catch (err) {
    console.error("[SensitiveAudit] Failed to log:", err);
  }
}

// ── Convenience wrappers ──

/** Log a financial data export */
export function auditExport(
  exportType: "excel" | "csv" | "pdf",
  entityType: string,
  recordCount: number,
  filename?: string,
  entityId?: string
): Promise<void> {
  return auditSensitiveAction({
    action: `export_${exportType}`,
    category: "EXPORT",
    entityType,
    entityId,
    metadata: { export_type: exportType, record_count: recordCount, filename },
  });
}

/** Log an admin action (user creation, role change, etc.) */
export function auditAdminAction(
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  return auditSensitiveAction({
    action,
    category: "ADMIN",
    entityType,
    entityId,
    metadata: details,
  });
}

/** Log document sharing */
export function auditShare(
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  return auditSensitiveAction({
    action,
    category: "SHARE",
    entityType,
    entityId,
    metadata: details,
  });
}

/** Log sensitive data access */
export function auditAccess(
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>
): Promise<void> {
  return auditSensitiveAction({
    action,
    category: "ACCESS",
    entityType,
    entityId,
    metadata: details,
  });
}
