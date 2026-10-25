import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ReservaOutput } from "@/lib/validations/quadra";
import type { QuadraReserva } from "@/types/quadra";

const db = () => supabase as any;

export const QUADRA_RESERVAS_KEY = ["quadra", "reservas"] as const;

export interface ReservasFiltro {
  /** YYYY-MM-DD inclusive */
  inicio?: string;
  fim?: string;
  status?: QuadraReserva["status"];
}

export function useQuadraReservas(filtro: ReservasFiltro = {}) {
  return useQuery({
    queryKey: [...QUADRA_RESERVAS_KEY, filtro],
    queryFn: async (): Promise<QuadraReserva[]> => {
      let q = db()
        .from("quadra_reservas")
        .select("*")
        .order("data", { ascending: true })
        .order("horario_inicio", { ascending: true });
      if (filtro.inicio) q = q.gte("data", filtro.inicio);
      if (filtro.fim) q = q.lte("data", filtro.fim);
      if (filtro.status) q = q.eq("status", filtro.status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, valor: Number(r.valor) }));
    },
  });
}

function invalidarTudo(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["quadra"] });
}

export function useCriarReserva() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReservaOutput) => {
      const { data, error } = await db().from("quadra_reservas").insert(input).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      invalidarTudo(queryClient);
      toast.success("Reserva criada");
    },
    onError: (e: Error) => toast.error("Não foi possível criar a reserva", { description: e.message }),
  });
}

export function useAtualizarReserva() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ReservaOutput> & { id: string }) => {
      const { error } = await db().from("quadra_reservas").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo(queryClient);
      toast.success("Reserva atualizada");
    },
    onError: (e: Error) => toast.error("Não foi possível atualizar a reserva", { description: e.message }),
  });
}

export function useExcluirReserva() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from("quadra_reservas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo(queryClient);
      toast.success("Reserva excluída");
    },
    onError: (e: Error) => toast.error("Não foi possível excluir a reserva", { description: e.message }),
  });
}
