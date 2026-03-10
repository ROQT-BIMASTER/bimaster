import { supabase } from "@/integrations/supabase/client";

/**
 * Envia um pagamento marcado como pago para o ERP.
 * Chamado automaticamente ao marcar como pago e disponível para reenvio manual.
 */
export async function exportPaymentToErp(paymentQueueId: string, channel?: string): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("erp-export-payment", {
      body: {
        action: "export",
        payment_queue_id: paymentQueueId,
        channel: channel || "n8n",
      },
    });

    if (error) {
      console.error("ERP export error:", error);
      return { success: false, message: error.message };
    }

    return { success: data?.success || false, message: data?.message };
  } catch (err: any) {
    console.error("ERP export exception:", err);
    return { success: false, message: err.message };
  }
}
