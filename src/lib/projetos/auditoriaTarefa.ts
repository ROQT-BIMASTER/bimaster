/**
 * Helper de auditoria para ações destrutivas/irreversíveis em tarefas.
 *
 * Grava no backend (`tarefa_auditoria_log`) quem concluiu, reabriu, excluiu
 * ou restaurou cada tarefa/subtarefa, com data/hora e título no momento da
 * ação. Falhas no registro NÃO devem bloquear o fluxo do usuário — o log é
 * complementar e usado apenas para auditoria.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type TarefaAuditAction =
  | "concluida"
  | "reaberta"
  | "excluida"
  | "restaurada";

export interface TarefaAuditPayload {
  tarefaId: string;
  projetoId?: string | null;
  parentTarefaId?: string | null;
  isSubtarefa?: boolean;
  tituloSnapshot?: string | null;
  action: TarefaAuditAction;
  metadata?: Record<string, unknown>;
}

export async function registrarAuditoriaTarefa(
  payload: TarefaAuditPayload,
): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    const { error } = await supabase
      .from("tarefa_auditoria_log" as any)
      .insert({
        tarefa_id: payload.tarefaId,
        projeto_id: payload.projetoId ?? null,
        parent_tarefa_id: payload.parentTarefaId ?? null,
        user_id: userId,
        action: payload.action,
        is_subtarefa: !!payload.isSubtarefa,
        titulo_snapshot: payload.tituloSnapshot ?? null,
        metadata: payload.metadata ?? {},
      } as any);
    if (error) logger.warn("[auditoriaTarefa] insert failed", error);
  } catch (e) {
    logger.warn("[auditoriaTarefa] exception", e);
  }
}
