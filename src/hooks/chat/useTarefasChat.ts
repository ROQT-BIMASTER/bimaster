/**
 * useTarefasChat — lista tarefas e subtarefas com chat ativo para o usuário,
 * usadas na aba "Tarefas" do hub de Chat. Vem da RPC SECURITY DEFINER
 * `rpc_chat_tarefas_do_usuario`, que faz a união de tarefas onde o usuário
 * é responsável, criador, colaborador, seguidor ou foi mencionado, restrita
 * a tarefas que possuem ao menos uma mensagem.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export interface TarefaChatItem {
  tarefa_id: string;
  projeto_id: string;
  projeto_nome: string;
  projeto_cor: string | null;
  parent_tarefa_id: string | null;
  parent_titulo: string | null;
  titulo: string;
  codigo: string | null;
  status: string | null;
  is_subtask: boolean;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  ultimo_autor_id: string | null;
  ultimo_autor_nome: string | null;
  nao_lidas: number;
  mencoes_abertas: number;
}

export type TarefaChatFiltro = "todas" | "nao_lidas" | "mencoes" | "subtarefas";

export function filtrarTarefasChat(
  list: TarefaChatItem[],
  busca: string,
  filtro: TarefaChatFiltro = "todas",
): TarefaChatItem[] {
  let r = list;
  if (filtro === "nao_lidas") r = r.filter((t) => t.nao_lidas > 0);
  if (filtro === "mencoes") r = r.filter((t) => t.mencoes_abertas > 0);
  if (filtro === "subtarefas") r = r.filter((t) => t.is_subtask);
  const q = busca.trim().toLowerCase();
  if (!q) return r;
  return r.filter(
    (t) =>
      t.titulo.toLowerCase().includes(q) ||
      t.projeto_nome.toLowerCase().includes(q) ||
      (t.ultima_mensagem ?? "").toLowerCase().includes(q),
  );
}

export function useTarefasChat() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const queryKey = ["chat-tarefas", userId];

  const query = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<TarefaChatItem[]> => {
      const { data, error } = await (supabase as any).rpc(
        "rpc_chat_tarefas_do_usuario",
      );
      if (error) throw error;
      return (data ?? []) as TarefaChatItem[];
    },
  });

  // Realtime: invalida quando novas mensagens são criadas em qualquer tarefa.
  // O filtro por interesse acontece server-side na própria RPC.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(uniqueChannelName(`chat-tarefas-${userId}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "projeto_tarefa_messages" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
}

export async function marcarTarefaChatLida(tarefaId: string) {
  await (supabase as any).rpc("rpc_tarefa_chat_marcar_lida", {
    p_tarefa_id: tarefaId,
  });
}
