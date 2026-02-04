import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CorporateEvent } from "./useCorporateEvents";

export function usePendingEvents() {
  return useQuery({
    queryKey: ["pending-corporate-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_events")
        .select(`
          *,
          budget:trade_budgets(id, name, code, available_amount),
          responsible:profiles!corporate_events_responsible_user_id_fkey(id, nome),
          creator:profiles!corporate_events_created_by_fkey(id, nome)
        `)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CorporateEvent[];
    },
  });
}
