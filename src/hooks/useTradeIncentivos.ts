import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TradeIncentivo {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  meta_valor: number;
  meta_unidade: string;
  recompensa: string | null;
  icone: string;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradeIncentivoProgresso {
  id: string;
  incentivo_id: string;
  user_id: string;
  valor_atual: number;
  concluido: boolean;
  updated_at: string;
}

export function useTradeIncentivos(onlyActive = false) {
  return useQuery({
    queryKey: ["trade-incentivos", onlyActive],
    queryFn: async () => {
      let query = supabase.from("trade_incentivos").select("*").order("data_inicio", { ascending: false });
      if (onlyActive) {
        const today = new Date().toISOString().split("T")[0];
        query = query.eq("ativo", true).lte("data_inicio", today).gte("data_fim", today);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as TradeIncentivo[];
    },
  });
}

export function useMyIncentivoProgresso(incentivoIds: string[]) {
  return useQuery({
    queryKey: ["trade-incentivo-progresso", incentivoIds],
    queryFn: async () => {
      if (!incentivoIds.length) return [];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("trade_incentivo_progresso")
        .select("*")
        .eq("user_id", user.id)
        .in("incentivo_id", incentivoIds);
      if (error) throw error;
      return data as TradeIncentivoProgresso[];
    },
    enabled: incentivoIds.length > 0,
  });
}

export function useCreateIncentivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incentivo: Omit<TradeIncentivo, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase.from("trade_incentivos").insert(incentivo).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-incentivos"] });
      toast.success("Incentivo criado com sucesso");
    },
    onError: () => toast.error("Erro ao criar incentivo"),
  });
}

export function useUpdateIncentivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TradeIncentivo> & { id: string }) => {
      const { data, error } = await supabase.from("trade_incentivos").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-incentivos"] });
      toast.success("Incentivo atualizado");
    },
    onError: () => toast.error("Erro ao atualizar incentivo"),
  });
}

export function useDeleteIncentivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trade_incentivos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-incentivos"] });
      toast.success("Incentivo removido");
    },
    onError: () => toast.error("Erro ao remover incentivo"),
  });
}
