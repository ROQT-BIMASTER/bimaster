import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface TarefaMeta {
  id: string;
  tarefa_id: string;
  descricao: string;
  data_meta: string | null;
  concluida: boolean;
  created_at: string;
}

export function useProjetoTarefaMetas(tarefaId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: metas = [], isLoading } = useQuery({
    queryKey: ["tarefa-metas", tarefaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_metas" as any)
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .order("data_meta", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as TarefaMeta[];
    },
    enabled: !!tarefaId && !!user,
  });

  const addMeta = useMutation({
    mutationFn: async (meta: { descricao: string; data_meta?: string }) => {
      const { error } = await supabase
        .from("projeto_tarefa_metas" as any)
        .insert({ tarefa_id: tarefaId, ...meta } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-metas", tarefaId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMeta = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TarefaMeta> & { id: string }) => {
      const { error } = await supabase
        .from("projeto_tarefa_metas" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-metas", tarefaId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMeta = useMutation({
    mutationFn: async (metaId: string) => {
      const { error } = await supabase
        .from("projeto_tarefa_metas" as any)
        .delete()
        .eq("id", metaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-metas", tarefaId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMeta = useMutation({
    mutationFn: async (meta: TarefaMeta) => {
      const { error } = await supabase
        .from("projeto_tarefa_metas" as any)
        .update({ concluida: !meta.concluida } as any)
        .eq("id", meta.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-metas", tarefaId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { metas, isLoading, addMeta, updateMeta, deleteMeta, toggleMeta };
}
