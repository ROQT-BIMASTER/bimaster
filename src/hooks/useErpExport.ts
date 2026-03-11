import { supabase } from "@/integrations/supabase/client";

export type ErpExportType = 'registration' | 'payment';

/**
 * Envia um pagamento para o ERP.
 * - registration: provisão ao aceitar (Aguardando Pagamento)
 * - payment: baixa ao pagar (Pago)
 */
export async function exportPaymentToErp(
  paymentQueueId: string,
  channel?: string,
  exportType?: ErpExportType
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("erp-export-payment", {
      body: {
        action: "export",
        payment_queue_id: paymentQueueId,
        channel: channel || "n8n",
        export_type: exportType || "payment",
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
