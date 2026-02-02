import { supabase } from "@/integrations/supabase/client";

interface AuditLogEntry {
  campaignId?: string;
  entityType?: "campaign" | "lancamento" | "product" | "expense";
  entityId?: string;
  action: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * Registra uma ação no log de auditoria
 */
export async function logAuditAction(entry: AuditLogEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("[AuditLog] Usuário não autenticado");
      return;
    }

    // Buscar nome do usuário
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", user.id)
      .maybeSingle();

    const { error } = await supabase
      .from("trade_campaign_audit_log")
      .insert({
        campaign_id: entry.campaignId || entry.entityId || null,
        entity_type: entry.entityType || "campaign",
        entity_id: entry.entityId || entry.campaignId || null,
        action: entry.action,
        field_changed: entry.fieldChanged || null,
        old_value: entry.oldValue || null,
        new_value: entry.newValue || null,
        user_id: user.id,
        user_name: profile?.nome || user.email || "Usuário desconhecido",
      });

    if (error) {
      console.error("[AuditLog] Erro ao registrar:", error);
    }
  } catch (err) {
    console.error("[AuditLog] Erro inesperado:", err);
  }
}

/**
 * Registra exclusão de uma campanha
 */
export async function logCampaignDelete(
  campaignId: string,
  campaignName: string,
  reason?: string
): Promise<void> {
  await logAuditAction({
    campaignId,
    entityType: "campaign",
    entityId: campaignId,
    action: "delete_campaign",
    fieldChanged: "status",
    oldValue: "active",
    newValue: reason ? `Excluída: ${reason}` : `Excluída: ${campaignName}`,
  });
}

/**
 * Registra exclusão de um lançamento
 */
export async function logLancamentoDelete(
  campaignId: string,
  lancamentoId: string,
  clienteName: string,
  reason?: string
): Promise<void> {
  await logAuditAction({
    campaignId,
    entityType: "lancamento",
    entityId: lancamentoId,
    action: "delete_lancamento",
    fieldChanged: "status",
    oldValue: "active",
    newValue: reason ? `Excluído: ${reason}` : `Excluído: ${clienteName}`,
  });
}

/**
 * Registra edição de uma campanha
 */
export async function logCampaignEdit(
  campaignId: string,
  changedFields: { field: string; oldValue: any; newValue: any }[]
): Promise<void> {
  for (const change of changedFields) {
    await logAuditAction({
      campaignId,
      entityType: "campaign",
      entityId: campaignId,
      action: "update_campaign",
      fieldChanged: change.field,
      oldValue: String(change.oldValue),
      newValue: String(change.newValue),
    });
  }
}

/**
 * Registra edição de um lançamento
 */
export async function logLancamentoEdit(
  campaignId: string,
  lancamentoId: string,
  changedFields: { field: string; oldValue: any; newValue: any }[]
): Promise<void> {
  for (const change of changedFields) {
    await logAuditAction({
      campaignId,
      entityType: "lancamento",
      entityId: lancamentoId,
      action: "update_lancamento",
      fieldChanged: change.field,
      oldValue: String(change.oldValue),
      newValue: String(change.newValue),
    });
  }
}
