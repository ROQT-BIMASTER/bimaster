import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SavedFilterPayload {
  search?: string;
  statusFilter?: string;
  filtroEspecial?: string;
}

export interface SavedFilter {
  id: string;
  nome: string;
  payload: SavedFilterPayload;
  is_default: boolean;
  created_at: string;
}

const KEY = ["china-recebimento-filtros"];

export function useSavedFiltersRecebimento() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<SavedFilter[]> => {
      const { data, error } = await supabase
        .from("china_recebimento_filtros_salvos" as any)
        .select("id, nome, payload, is_default, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
  });
}

export function useSaveFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { nome: string; payload: SavedFilterPayload; is_default?: boolean }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Sem sessão");
      if (p.is_default) {
        await supabase
          .from("china_recebimento_filtros_salvos" as any)
          .update({ is_default: false } as any)
          .eq("user_id", user.id);
      }
      const { error } = await supabase.from("china_recebimento_filtros_salvos" as any).insert({
        user_id: user.id,
        nome: p.nome,
        payload: p.payload as any,
        is_default: !!p.is_default,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Filtro salvo");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar filtro"),
  });
}

export function useSetDefaultFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Sem sessão");
      await supabase
        .from("china_recebimento_filtros_salvos" as any)
        .update({ is_default: false } as any)
        .eq("user_id", user.id);
      const { error } = await supabase
        .from("china_recebimento_filtros_salvos" as any)
        .update({ is_default: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (e: any) => toast.error(e.message || "Erro"),
  });
}

export function useDeleteSavedFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("china_recebimento_filtros_salvos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Filtro removido");
    },
  });
}
