import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TradeBanner {
  id: string;
  titulo: string;
  imagem_url: string;
  link_destino: string | null;
  posicao: number;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useTradeBanners() {
  return useQuery({
    queryKey: ["trade-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_banners")
        .select("*")
        .order("posicao", { ascending: true });
      if (error) throw error;
      return data as TradeBanner[];
    },
  });
}

export function useActiveTradeBanners() {
  return useQuery({
    queryKey: ["trade-banners-active"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("trade_banners")
        .select("*")
        .eq("ativo", true)
        .lte("data_inicio", now)
        .or(`data_fim.is.null,data_fim.gte.${now}`)
        .order("posicao", { ascending: true });
      if (error) throw error;
      return data as TradeBanner[];
    },
  });
}

export function useCreateBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (banner: Omit<TradeBanner, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase.from("trade_banners").insert(banner).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-banners"] });
      toast.success("Banner criado com sucesso");
    },
    onError: () => toast.error("Erro ao criar banner"),
  });
}

export function useUpdateBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TradeBanner> & { id: string }) => {
      const { data, error } = await supabase.from("trade_banners").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-banners"] });
      toast.success("Banner atualizado");
    },
    onError: () => toast.error("Erro ao atualizar banner"),
  });
}

export function useDeleteBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trade_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade-banners"] });
      toast.success("Banner removido");
    },
    onError: () => toast.error("Erro ao remover banner"),
  });
}
