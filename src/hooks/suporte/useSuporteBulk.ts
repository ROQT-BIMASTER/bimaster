import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SuportePrioridade, SuporteTicketStatus } from "./types";

export interface BulkPatch {
  assignee_id?: string | null;
  fila_id?: string;
  status?: SuporteTicketStatus;
  prioridade?: SuportePrioridade;
}

export interface BulkResult {
  updated: number;
  errors: { ticket_id: string; motivo: string }[];
}

export function useSuporteBulkUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ticketIds: string[]; patch: BulkPatch }): Promise<BulkResult> => {
      const { data, error } = await (supabase.rpc as any)("rpc_suporte_bulk_update", {
        p_ticket_ids: input.ticketIds,
        p_patch: input.patch,
      });
      if (error) throw error;
      return data as BulkResult;
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["suporte"] });
      const total = vars.ticketIds.length;
      const err = res.errors?.length ?? 0;
      if (err === 0) {
        toast.success(`${res.updated} chamado(s) atualizado(s)`);
      } else {
        toast.warning(`${res.updated} atualizado(s), ${err} com erro`, {
          description: res.errors.slice(0, 3).map((e) => e.motivo).join(", "),
        });
      }
      void total;
    },
    onError: (err: Error) => {
      toast.error("Erro na ação em lote", { description: err.message });
    },
  });
}
