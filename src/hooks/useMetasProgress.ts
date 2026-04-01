import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MetasProgress {
  tarefa_id: string;
  total: number;
  concluidas: number;
  percent: number;
}

/**
 * Batch-fetch checklist (metas) progress for a list of task IDs.
 * Returns a map of tarefa_id -> { total, concluidas, percent }
 */
export function useMetasProgress(tarefaIds: string[]) {
  const { user } = useAuth();

  const { data: progressMap = {} } = useQuery({
    queryKey: ["metas-progress", ...tarefaIds.sort()],
    queryFn: async () => {
      if (tarefaIds.length === 0) return {};

      const { data, error } = await supabase
        .from("projeto_tarefa_metas" as any)
        .select("tarefa_id, concluida")
        .in("tarefa_id", tarefaIds);

      if (error) throw error;

      const map: Record<string, MetasProgress> = {};
      for (const row of (data as any[]) || []) {
        const tid = row.tarefa_id;
        if (!map[tid]) map[tid] = { tarefa_id: tid, total: 0, concluidas: 0, percent: 0 };
        map[tid].total++;
        if (row.concluida) map[tid].concluidas++;
      }

      for (const key of Object.keys(map)) {
        map[key].percent = map[key].total > 0
          ? Math.round((map[key].concluidas / map[key].total) * 100)
          : 0;
      }

      return map;
    },
    enabled: !!user && tarefaIds.length > 0,
    staleTime: 30_000,
  });

  return progressMap;
}
