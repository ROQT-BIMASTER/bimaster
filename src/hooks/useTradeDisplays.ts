import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TradeDisplay {
  id: string;
  nome: string;
  codigo: string | null;
  descricao: string | null;
  categoria: string | null;
  largura_cm: number | null;
  profundidade_cm: number | null;
  altura_cm: number | null;
  material: string | null;
  foto_url: string | null;
  fotos_extras: string[];
  ativo: boolean;
  posicao: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useTradeDisplays() {
  return useQuery({
    queryKey: ["trade-displays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_displays")
        .select("*")
        .order("posicao", { ascending: true });
      if (error) throw error;
      return data as TradeDisplay[];
    },
  });
}

export function useActiveTradeDisplays() {
  return useQuery({
    queryKey: ["trade-displays-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_displays")
        .select("*")
        .eq("ativo", true)
        .order("posicao", { ascending: true });
      if (error) throw error;
      return data as TradeDisplay[];
    },
  });
}

export function useCreateDisplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (display: Partial<TradeDisplay>) => {
      const { data, error } = await supabase
        .from("trade_displays")
        .insert(display as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-displays"] });
      toast.success("Display criado com sucesso");
    },
    onError: () => toast.error("Erro ao criar display"),
  });
}

export function useUpdateDisplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TradeDisplay> & { id: string }) => {
      const { data, error } = await supabase
        .from("trade_displays")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-displays"] });
      toast.success("Display atualizado");
    },
    onError: () => toast.error("Erro ao atualizar display"),
  });
}

export function useDeleteDisplay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trade_displays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-displays"] });
      toast.success("Display removido");
    },
    onError: () => toast.error("Erro ao remover display"),
  });
}
