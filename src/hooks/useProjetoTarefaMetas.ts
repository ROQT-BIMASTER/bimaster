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
  const queryKey = ["tarefa-metas", tarefaId];

  const { data: metas = [], isLoading } = useQuery({
    queryKey,
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

  // Helpers para snapshot + patch otimista — mesmo padrão usado em tarefas.
  const snapshot = () => queryClient.getQueryData<TarefaMeta[]>(queryKey);
  const patch = (mutator: (prev: TarefaMeta[]) => TarefaMeta[]) => {
    queryClient.setQueryData<TarefaMeta[]>(queryKey, (old) => mutator(old || []));
  };
  const rollback = (previous: TarefaMeta[] | undefined) => {
    if (previous !== undefined) queryClient.setQueryData(queryKey, previous);
  };

  const addMeta = useMutation({
    mutationFn: async (meta: { descricao: string; data_meta?: string }) => {
      const { error } = await supabase
        .from("projeto_tarefa_metas" as any)
        .insert({ tarefa_id: tarefaId, ...meta } as any);
      if (error) throw error;
    },
    onMutate: async (meta) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot();
      const optimistic: TarefaMeta = {
        id: `temp-${crypto.randomUUID()}`,
        tarefa_id: tarefaId!,
        descricao: meta.descricao,
        data_meta: meta.data_meta || null,
        concluida: false,
        created_at: new Date().toISOString(),
      };
      patch((prev) => [...prev, optimistic]);
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      rollback(ctx?.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMeta = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TarefaMeta> & { id: string }) => {
      const { error } = await supabase
        .from("projeto_tarefa_metas" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot();
      patch((prev) => prev.map(m => m.id === id ? { ...m, ...updates } as TarefaMeta : m));
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      rollback(ctx?.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMeta = useMutation({
    mutationFn: async (metaId: string) => {
      const { error } = await supabase
        .from("projeto_tarefa_metas" as any)
        .delete()
        .eq("id", metaId);
      if (error) throw error;
    },
    onMutate: async (metaId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot();
      patch((prev) => prev.filter(m => m.id !== metaId));
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      rollback(ctx?.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const toggleMeta = useMutation({
    mutationFn: async (meta: TarefaMeta) => {
      const { error } = await supabase
        .from("projeto_tarefa_metas" as any)
        .update({ concluida: !meta.concluida } as any)
        .eq("id", meta.id);
      if (error) throw error;
    },
    onMutate: async (meta) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = snapshot();
      patch((prev) => prev.map(m => m.id === meta.id ? { ...m, concluida: !m.concluida } : m));
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      rollback(ctx?.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return { metas, isLoading, addMeta, updateMeta, deleteMeta, toggleMeta };
}
