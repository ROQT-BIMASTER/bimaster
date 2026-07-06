import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

/**
 * Contadores autoritativos vindos direto do banco para o usuário logado.
 *
 * Usado como fonte de verdade para diagnosticar divergências entre o payload
 * exibido na tela "Minhas Tarefas" (que pode ser cortado pelo limite de 1000
 * linhas do PostgREST em usuários com histórico grande) e o total real de
 * tarefas ativas/concluídas do usuário no banco.
 *
 * A RPC `rpc_minhas_tarefas_stats` é `SECURITY DEFINER` e só retorna dados
 * das tarefas em que o usuário é responsável, colaborador ou seguidor.
 */
export interface MinhasTarefasStats {
  total: number;
  ativas: number;
  concluidas: number;
  concluidas_30d: number;
  concluidas_hoje: number;
}

const ZERO: MinhasTarefasStats = {
  total: 0,
  ativas: 0,
  concluidas: 0,
  concluidas_30d: 0,
  concluidas_hoje: 0,
};

export function useMinhasTarefasStats() {
  const { user } = useAuth();
  return useQuery<MinhasTarefasStats>({
    queryKey: ["minhas-tarefas-stats", user?.id],
    enabled: !!user?.id,
    // 60s é suficiente para diagnóstico sem sobrecarregar o banco.
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("rpc_minhas_tarefas_stats");
      if (error) {
        logger.warn("[useMinhasTarefasStats] Falha ao consultar contadores", { error });
        return ZERO;
      }
      const row = Array.isArray(data) ? data[0] : data;
      const parsed: MinhasTarefasStats = {
        total: Number(row?.total ?? 0),
        ativas: Number(row?.ativas ?? 0),
        concluidas: Number(row?.concluidas ?? 0),
        concluidas_30d: Number(row?.concluidas_30d ?? 0),
        concluidas_hoje: Number(row?.concluidas_hoje ?? 0),
      };
      logger.info("[minhas-tarefas] stats do banco", parsed);
      return parsed;
    },
  });
}
