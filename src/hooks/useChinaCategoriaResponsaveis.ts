import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface CategoriaResponsavel {
  id: string;
  categoria_key: string;
  categoria_nome: string;
  responsavel_id: string;
  projeto_id: string | null;
  created_by: string | null;
  created_at: string;
}

export function useCategoriaResponsaveis(projetoId: string | null) {
  return useQuery({
    queryKey: ["china-cat-responsaveis", projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_categoria_responsaveis" as any)
        .select("*")
        .eq("projeto_id", projetoId!) as any);
      if (error) throw error;
      return (data || []) as CategoriaResponsavel[];
    },
  });
}

export function useUpsertCategoriaResponsavel() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      categoria_key: string;
      categoria_nome: string;
      responsavel_id: string;
      projeto_id: string;
    }) => {
      // Upsert based on unique constraint (categoria_key, projeto_id)
      const { error } = await (supabase
        .from("china_categoria_responsaveis" as any)
        .upsert({
          ...params,
          created_by: user?.id || null,
        }, { onConflict: "categoria_key,projeto_id" }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["china-cat-responsaveis"] });
      toast.success("Responsável da categoria atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar responsável");
    },
  });
}
