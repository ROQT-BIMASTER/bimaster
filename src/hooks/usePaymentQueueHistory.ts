import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PaymentQueueHistoryEntry {
  id: string;
  payment_queue_id: string;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
  action: string;
  snapshot: Record<string, any>;
  changes: Record<string, any> | null;
}

const ACTION_LABELS: Record<string, string> = {
  submitted: "Enviado ao Financeiro",
  corrected: "Corrigido e Reenviado",
  rejected: "Rejeitado pelo Financeiro",
  approved: "Aprovado pelo Financeiro",
  paid: "Pagamento Realizado",
  edited_by_financial: "Editado pelo Financeiro",
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

export function usePaymentQueueHistory(paymentQueueId?: string | null) {
  return useQuery({
    queryKey: ["payment-queue-history", paymentQueueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_payment_queue_history" as any)
        .select("*")
        .eq("payment_queue_id", paymentQueueId!)
        .order("changed_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as PaymentQueueHistoryEntry[];
    },
    enabled: !!paymentQueueId,
    staleTime: 30_000,
  });
}
