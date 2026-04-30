import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Retorna um mapa { tarefa_id -> count } com a quantidade de comentários
 * (`projeto_tarefa_messages`) por tarefa, em uma única query agregada
 * client-side. Pensado para listas de tarefas onde precisamos exibir um
 * badge com o número de mensagens por linha sem montar um hook por linha.
 */
export function useTarefaMessageCounts(tarefaIds: string[]) {
  // Chave estável: ordena ids para evitar refetch quando a ordem muda
  const sortedKey = [...tarefaIds].sort().join(",");

  return useQuery({
    queryKey: ["tarefa-message-counts", sortedKey],
    queryFn: async (): Promise<Record<string, number>> => {
      if (tarefaIds.length === 0) return {};
      const { data, error } = await supabase
        .from("projeto_tarefa_messages" as any)
        .select("tarefa_id")
        .in("tarefa_id", tarefaIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data as any[]) || []) {
        counts[row.tarefa_id] = (counts[row.tarefa_id] || 0) + 1;
      }
      return counts;
    },
    enabled: tarefaIds.length > 0,
    staleTime: 30_000,
  });
}
