import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface TarefaMetaCalendario {
  id: string;
  projeto_id: string;
  tarefa_id: string;
  titulo: string;
  tipo: string;
  valor: string | null;
  cumprida: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProjetoTarefaMetasCalendario(projetoId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tarefaMetas = [], isLoading } = useQuery({
    queryKey: ["projeto-tarefa-metas-calendario", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];
      const { data, error } = await supabase
        .from("projeto_tarefa_metas_calendario" as any)
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TarefaMetaCalendario[];
    },
    enabled: !!projetoId,
  });

  const createTarefaMeta = useMutation({
    mutationFn: async (meta: Omit<TarefaMetaCalendario, "id" | "created_at" | "updated_at" | "created_by">) => {
      const { error } = await supabase
        .from("projeto_tarefa_metas_calendario" as any)
        .insert({ ...meta, created_by: user?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefa-metas-calendario", projetoId] });
      toast.success("Meta da tarefa criada");
    },
    onError: () => toast.error("Erro ao criar meta"),
  });

  const updateTarefaMeta = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TarefaMetaCalendario> & { id: string }) => {
      const { error } = await supabase
        .from("projeto_tarefa_metas_calendario" as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefa-metas-calendario", projetoId] });
    },
  });

  const deleteTarefaMeta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projeto_tarefa_metas_calendario" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-tarefa-metas-calendario", projetoId] });
      toast.success("Meta removida");
    },
  });

  return { tarefaMetas, isLoading, createTarefaMeta, updateTarefaMeta, deleteTarefaMeta };
}
