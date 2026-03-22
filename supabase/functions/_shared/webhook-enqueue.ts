// _shared/webhook-enqueue.ts — Helper to enqueue webhook events after CRUD operations
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Enqueue a webhook event for outbound dispatch.
 * Non-blocking: errors are logged but never thrown.
 */
export async function enqueueWebhookEvent(
  evento: string,
  payload: Record<string, unknown>,
  empresaId?: string | number | null
): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const pEmpresaId = empresaId ? parseInt(String(empresaId)) : null;

    await supabase.rpc("enqueue_webhook_event", {
      p_evento: evento,
      p_payload: payload,
      p_empresa_id: isNaN(pEmpresaId!) ? null : pEmpresaId,
    });
  } catch (e) {
    console.error(`[webhook-enqueue] Failed to enqueue ${evento}:`, e);
  }
}
