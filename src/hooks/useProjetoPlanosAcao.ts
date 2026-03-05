import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PlanoAcao {
  id: string;
  projeto_id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  responsavel_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjetoPlanosAcao(projetoId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: planos = [], isLoading } = useQuery({
    queryKey: ["projeto-planos-acao", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];
      const { data, error } = await supabase
        .from("projeto_planos_acao" as any)
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PlanoAcao[];
    },
    enabled: !!projetoId,
  });

  const createPlano = useMutation({
    mutationFn: async (plano: Omit<PlanoAcao, "id" | "created_at" | "updated_at" | "created_by">) => {
      const { error } = await supabase
        .from("projeto_planos_acao" as any)
        .insert({ ...plano, created_by: user?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-planos-acao", projetoId] });
      toast.success("Plano de ação criado");
    },
    onError: () => toast.error("Erro ao criar plano de ação"),
  });

  const updatePlano = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlanoAcao> & { id: string }) => {
      const { error } = await supabase
        .from("projeto_planos_acao" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-planos-acao", projetoId] });
    },
  });

  const deletePlano = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projeto_planos_acao" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-planos-acao", projetoId] });
      toast.success("Plano removido");
    },
  });

  return { planos, isLoading, createPlano, updatePlano, deletePlano };
}
