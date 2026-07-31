import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TarefaAcaoHistorico {
  id: string;
  tipo: "aprovacao" | "urgente";
  titulo: string;
  detalhe: string | null;
  status: string | null;
  created_at: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_avatar: string | null;
}

/**
 * Histórico de envios para aprovação e chamadas de atenção vinculados a uma tarefa.
 */
export function useTarefaAcoesHistorico(tarefaId?: string | null, limit = 30) {
  return useQuery({
    queryKey: ["tarefa-acoes-historico", tarefaId, limit],
    enabled: !!tarefaId,
    staleTime: 30_000,
    queryFn: async (): Promise<TarefaAcaoHistorico[]> => {
      const { data, error } = await (supabase.rpc as any)(
        "rpc_tarefa_historico_acoes_chat",
        { p_tarefa_id: tarefaId, p_limit: limit },
      );
      if (error) throw error;
      return (data ?? []) as TarefaAcaoHistorico[];
    },
  });
}
