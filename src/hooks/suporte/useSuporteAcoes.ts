import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SuportePrioridade, SuporteTicketStatus } from "./types";

interface AbrirChamadoInput {
  filaId: string;
  titulo: string;
  descricao?: string;
  prioridade?: SuportePrioridade;
}

interface AbrirChamadoResult {
  ticket_id: string;
  conversa_id: string;
  protocolo: string;
}

/** Ações do módulo Suporte v2 — todas via RPCs SECURITY DEFINER (Fase 1). */
export function useSuporteAcoes() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["suporte"] });
    qc.invalidateQueries({ queryKey: ["chat", "conversas"] });
  };

  const abrirChamado = useMutation({
    mutationFn: async (input: AbrirChamadoInput): Promise<AbrirChamadoResult> => {
      const { data, error } = await (supabase.rpc as any)("rpc_suporte_abrir_chamado", {
        p_fila_id: input.filaId,
        p_titulo: input.titulo,
        p_descricao: input.descricao ?? null,
        p_prioridade: input.prioridade ?? "media",
      });
      if (error) throw error;
      return data as AbrirChamadoResult;
    },
    onSuccess: (res) => {
      invalidate();
      toast.success("Chamado aberto", { description: `Protocolo ${res.protocolo}` });
    },
    onError: (err: Error) => {
      toast.error("Erro ao abrir chamado", { description: err.message });
    },
  });

  const assumir = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await (supabase.rpc as any)("rpc_suporte_assumir", {
        p_ticket_id: ticketId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Chamado assumido");
    },
    onError: (err: Error) => {
      toast.error("Erro ao assumir chamado", { description: err.message });
    },
  });

  const mudarStatus = useMutation({
    mutationFn: async (input: { ticketId: string; status: SuporteTicketStatus }) => {
      const { error } = await (supabase.rpc as any)("rpc_suporte_mudar_status", {
        p_ticket_id: input.ticketId,
        p_status: input.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Status atualizado");
    },
    onError: (err: Error) => {
      toast.error("Erro ao mudar status", { description: err.message });
    },
  });

  const transferir = useMutation({
    mutationFn: async (input: {
      ticketId: string;
      filaDestinoId: string;
      motivo: string;
    }): Promise<{ para_fila_nome: string; protocolo: string | null }> => {
      const { data, error } = await (supabase.rpc as any)("rpc_suporte_transferir", {
        p_ticket_id: input.ticketId,
        p_fila_destino_id: input.filaDestinoId,
        p_motivo: input.motivo,
      });
      if (error) throw error;
      return data as { para_fila_nome: string; protocolo: string | null };
    },
    onSuccess: (res) => {
      invalidate();
      toast.success(`Chamado transferido para ${res.para_fila_nome}`);
    },
    onError: (err: Error) => {
      toast.error("Erro ao transferir chamado", { description: err.message });
    },
  });

  return { abrirChamado, assumir, mudarStatus, transferir };
}
