import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EXPENSE_CATEGORIES, type ExpenseAttachment } from "./useEventExpenses";

export interface PendingExpense {
  id: string;
  event_id: string;
  category: string;
  description: string | null;
  valor_previsto: number;
  valor_realizado: number;
  expense_date: string | null;
  comprovante_url: string | null;
  attachments: ExpenseAttachment[];
  created_at: string;
  creator?: {
    id: string;
    nome: string;
  };
}

export interface EventWithPendingExpenses {
  event_id: string;
  event_code: string;
  event_name: string;
  expenses: PendingExpense[];
  total_pending: number;
  total_value: number;
}

export function usePendingEventExpenses() {
  return useQuery({
    queryKey: ["pending-event-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corporate_event_expenses")
        .select(`
          id,
          event_id,
          category,
          description,
          valor_previsto,
          valor_realizado,
          expense_date,
          comprovante_url,
          attachments,
          created_at,
          creator:profiles!corporate_event_expenses_created_by_fkey(id, nome),
          event:corporate_events!inner(id, code, name, status)
        `)
        .eq("status", "pending")
        .in("event.status", ["approved", "in_progress"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group expenses by event
      const eventMap = new Map<string, EventWithPendingExpenses>();

      for (const item of data || []) {
        const event = item.event as unknown as { id: string; code: string; name: string; status: string };
        if (!event) continue;

        const eventId = event.id;

        if (!eventMap.has(eventId)) {
          eventMap.set(eventId, {
            event_id: eventId,
            event_code: event.code,
            event_name: event.name,
            expenses: [],
            total_pending: 0,
            total_value: 0,
          });
        }

        const group = eventMap.get(eventId)!;
        group.expenses.push({
          id: item.id,
          event_id: item.event_id,
          category: item.category,
          description: item.description,
          valor_previsto: item.valor_previsto,
          valor_realizado: item.valor_realizado,
          expense_date: item.expense_date,
          comprovante_url: item.comprovante_url,
          attachments: (item.attachments as unknown as ExpenseAttachment[]) || [],
          created_at: item.created_at,
          creator: item.creator as unknown as { id: string; nome: string },
        });
        group.total_pending += 1;
        group.total_value += item.valor_realizado || item.valor_previsto || 0;
      }

      return Array.from(eventMap.values());
    },
  });
}

export function getCategoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;
}
