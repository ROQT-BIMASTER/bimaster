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

  // Ignora IDs otimistas (`temp-*`) que ainda não existem no banco. Sem esse
  // filtro, cada criação de subtarefa dispara DUAS queries novas (uma com
  // o tempId, outra com o id real), causando 2 commits colaterais em quem
  // consome `metasProgress` (ex.: `ProjetoListView`) — origem confirmada
  // do flicker "3 piscadas" ao criar subtarefa.
  const realIds = tarefaIds.filter((id) => id && !id.startsWith("temp-"));
  // Chave estável: string única (evita spread do array na queryKey, que
  // também mudava a referência sem necessidade e forçava novo `useQuery`).
  const idsKey = realIds.slice().sort().join(",");

  const { data: progressMap = {} } = useQuery({
    queryKey: ["metas-progress", idsKey],
    queryFn: async () => {
      if (realIds.length === 0) return {};

      const { data, error } = await supabase
        .from("projeto_tarefa_metas" as any)
        .select("tarefa_id, concluida")
        .in("tarefa_id", realIds);

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
    enabled: !!user && realIds.length > 0,
    staleTime: 30_000,
    // Mantém o resultado anterior enquanto a query com nova chave carrega —
    // essencial para não introduzir loading state (=render extra) quando um
    // id novo entra no set (ex.: subtarefa recém-criada).
    placeholderData: (prev) => prev,
  });

  return progressMap;
}
