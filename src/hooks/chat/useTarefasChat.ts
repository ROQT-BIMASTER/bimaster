/**
 * useTarefasChat — lista tarefas e subtarefas com chat ativo para o usuário,
 * usadas na aba "Tarefas" do hub de Chat. Vem da RPC SECURITY DEFINER
 * `rpc_chat_tarefas_do_usuario`, que faz a união de tarefas onde o usuário
 * é responsável, criador, colaborador, seguidor ou foi mencionado, restrita
 * a tarefas que possuem ao menos uma mensagem. Também expõe preferências
 * pessoais (`muted`, `archived`) e mutations para silenciar/arquivar a
 * conversa sem perder histórico.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { toast } from "sonner";

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
  muted: boolean;
  archived: boolean;
}

export type TarefaChatFiltro =
  | "todas"
  | "tarefas"
  | "subtarefas"
  | "nao_lidas"
  | "mencoes"
  | "arquivadas";

/**
 * Filtra a lista respeitando o filtro selecionado.
 * - Arquivadas só aparecem quando o filtro for "arquivadas".
 * - Silenciadas continuam visíveis (não somem da lista), apenas não
 *   geram notificações nem contam para o badge global.
 */
export function filtrarTarefasChat(
  list: TarefaChatItem[],
  busca: string,
  filtro: TarefaChatFiltro = "todas",
): TarefaChatItem[] {
  let r = list;

  if (filtro === "arquivadas") {
    r = r.filter((t) => t.archived);
  } else {
    r = r.filter((t) => !t.archived);
    if (filtro === "tarefas") r = r.filter((t) => !t.is_subtask);
    if (filtro === "subtarefas") r = r.filter((t) => t.is_subtask);
    if (filtro === "nao_lidas") r = r.filter((t) => t.nao_lidas > 0 && !t.muted);
    if (filtro === "mencoes") r = r.filter((t) => t.mencoes_abertas > 0);
  }

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

/**
 * Mutation para silenciar/desilenciar e arquivar/desarquivar uma conversa
 * de tarefa. Faz upsert em `projeto_tarefa_chat_preferencias`.
 */
export function useTarefaChatPreferencia() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: {
      tarefaId: string;
      muted?: boolean;
      archived?: boolean;
    }) => {
      if (!user) throw new Error("Sessão expirada");
      const payload: any = {
        user_id: user.id,
        tarefa_id: args.tarefaId,
        updated_at: new Date().toISOString(),
      };
      if (typeof args.muted === "boolean") payload.muted = args.muted;
      if (typeof args.archived === "boolean") payload.archived = args.archived;
      const { error } = await (supabase as any)
        .from("projeto_tarefa_chat_preferencias")
        .upsert(payload, { onConflict: "user_id,tarefa_id" });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["chat-tarefas", user?.id] });
      if (typeof vars.muted === "boolean") {
        toast.success(vars.muted ? "Conversa silenciada" : "Notificações reativadas");
      }
      if (typeof vars.archived === "boolean") {
        toast.success(vars.archived ? "Conversa arquivada" : "Conversa restaurada");
      }
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Falha ao atualizar preferência"),
  });
}
