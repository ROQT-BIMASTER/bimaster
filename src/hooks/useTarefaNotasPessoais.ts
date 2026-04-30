import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface TarefaNotaPessoal {
  id: string;
  tarefa_id: string;
  user_id: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
}

const MAX_LEN = 10_000;

/**
 * Anotações pessoais privadas: uma por usuário por tarefa, visível apenas ao autor.
 * RLS garante isolamento; aqui aplicamos upsert no save.
 */
export function useTarefaNotasPessoais(tarefaId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["tarefa-nota-pessoal", tarefaId, user?.id],
    queryFn: async () => {
      if (!tarefaId || !user) return null;
      const { data, error } = await supabase
        .from("projeto_tarefa_notas_pessoais" as any)
        .select("*")
        .eq("tarefa_id", tarefaId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data as any) as TarefaNotaPessoal | null;
    },
    enabled: !!tarefaId && !!user,
  });

  const save = useMutation({
    mutationFn: async (conteudo: string) => {
      if (!tarefaId || !user) throw new Error("Sessão inválida");
      const trimmed = (conteudo || "").slice(0, MAX_LEN);
      const { error } = await supabase
        .from("projeto_tarefa_notas_pessoais" as any)
        .upsert(
          { tarefa_id: tarefaId, user_id: user.id, conteudo: trimmed },
          { onConflict: "tarefa_id,user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefa-nota-pessoal", tarefaId, user?.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!tarefaId || !user) throw new Error("Sessão inválida");
      const { error } = await supabase
        .from("projeto_tarefa_notas_pessoais" as any)
        .delete()
        .eq("tarefa_id", tarefaId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefa-nota-pessoal", tarefaId, user?.id] });
      toast.success("Anotação pessoal removida");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { nota: query.data, isLoading: query.isLoading, save, remove, MAX_LEN };
}
