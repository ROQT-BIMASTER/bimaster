import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FinancialQueueInfo {
  id: string;
  financial_status: string;
  financial_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_name?: string;
  rejection_category?: string | null;
  rejection_fields?: string[] | null;
}

/**
 * Fetches financial payment queue status for expenses that have been sent to financial.
 * Maps payment_queue_id → FinancialQueueInfo
 */
export function useExpenseFinancialStatus(paymentQueueIds: (string | null | undefined)[]) {
  const validIds = paymentQueueIds.filter((id): id is string => !!id);

  return useQuery({
    queryKey: ["expense-financial-status", validIds.sort().join(",")],
    queryFn: async () => {
      if (validIds.length === 0) return new Map<string, FinancialQueueInfo>();

      const { data, error } = await supabase
        .from("financial_payment_queue")
        .select("id, financial_status, financial_notes, reviewed_at, reviewed_by")
        .in("id", validIds);

      if (error) throw error;

      // Resolve reviewer names
      const reviewerIds = [...new Set((data || []).filter(d => d.reviewed_by).map(d => d.reviewed_by!))];
      let nameMap = new Map<string, string>();
      if (reviewerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", reviewerIds);
        if (profiles) {
          nameMap = new Map(profiles.map(p => [p.id, p.nome]));
        }
      }

      const result = new Map<string, FinancialQueueInfo>();
      for (const item of data || []) {
        result.set(item.id, {
          ...item,
          reviewer_name: item.reviewed_by ? nameMap.get(item.reviewed_by) : undefined,
        });
      }
      return result;
    },
    enabled: validIds.length > 0,
    staleTime: 30_000,
  });
}
