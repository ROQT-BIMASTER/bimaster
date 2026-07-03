import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { ChatTipoMensagem } from "./types";

export interface SendMessageInput {
  conversaId: string;
  conteudo: string;
  tipo?: ChatTipoMensagem;
  responde_a_id?: string | null;
  encaminhada_de_id?: string | null;
  mencoes?: string[];
  anexos?: Array<{
    file_name: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    width?: number;
    height?: number;
    duration_ms?: number;
  }>;
  metadata?: Record<string, unknown>;
}

export function useChatActions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user?.id;

  const invalidate = (conversaId?: string) => {
    qc.invalidateQueries({ queryKey: ["chat", "conversas"] });
    if (conversaId) qc.invalidateQueries({ queryKey: ["chat", "mensagens", conversaId] });
  };

  const SUPORTE_CONV_ID = "3daf9772-404f-42f4-adbf-8a2566d91870";

  const sendMessage = useMutation({
    mutationFn: async (input: SendMessageInput) => {
      if (!uid) throw new Error("não autenticado");
      const { data: suporteTicket, error: suporteTicketError } = await supabase
        .from("suporte_tickets" as any)
        .select("id, owner_id, requester_id")
        .eq("conversa_id", input.conversaId)
        .neq("status", "resolvido")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (suporteTicketError) throw suporteTicketError;

      const suporteMeta = suporteTicket
        ? {
            ticket_id: suporteTicket.id,
            ticket_owner_id: suporteTicket.requester_id ?? suporteTicket.owner_id,
            visibilidade: "broadcast",
          }
        : {};

      const { data: msg, error } = await supabase
        .from("mensagens")
        .insert([{
          conversa_id: input.conversaId,
          remetente_id: uid,
          conteudo: input.conteudo,
          tipo: input.tipo ?? "texto",
          responde_a_id: input.responde_a_id ?? null,
          encaminhada_de_id: input.encaminhada_de_id ?? null,
          mencoes: input.mencoes ?? [],
          metadata: input.metadata ?? {},
          ...suporteMeta,
        }] as any)
        .select("id, conversa_id, ticket_id")
        .single();
      if (error) throw error;
      if (input.anexos?.length) {
        const rows = input.anexos.map((a) => ({
          mensagem_id: msg.id,
          conversa_id: msg.conversa_id,
          uploader_id: uid,
          file_name: a.file_name,
          storage_path: a.storage_path,
          mime_type: a.mime_type,
          size_bytes: a.size_bytes,
          width: a.width,
          height: a.height,
          duration_ms: a.duration_ms,
        }));
        const { error: aErr } = await supabase.from("mensagens_anexos").insert(rows);
        if (aErr) throw aErr;
      }

      // Dispara o agente Ruby Rose imediatamente após envio no canal Suporte.
      // Fire-and-forget: não bloqueia UI nem falha o envio se a IA estiver indisponível.
      // Mais confiável que o Realtime, que pode estar CLOSED ou montado em outra rota.
      if (input.conversaId === SUPORTE_CONV_ID) {
        supabase.functions
          .invoke("suporte-agente", { body: { mensagem_id: msg.id } })
          .catch((err) => console.warn("[suporte-agente] invoke falhou:", err));
      }

      return msg;
    },
    onSuccess: (m) => {
      invalidate(m.conversa_id);
      if ((m as any).ticket_id) qc.invalidateQueries({ queryKey: ["suporte"] });
    },
    onError: (e: any) => toast.error("Erro ao enviar: " + (e?.message ?? "")),
  });

  const editMessage = useMutation({
    mutationFn: async (vars: { id: string; conversaId: string; conteudo: string }) => {
      const { error } = await supabase
        .from("mensagens")
        .update({ conteudo: vars.conteudo, editada_em: new Date().toISOString() })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.conversaId),
    onError: (e: any) => toast.error("Erro ao editar: " + e.message),
  });

  const deleteMessage = useMutation({
    mutationFn: async (vars: { id: string; conversaId: string; paraTodos: boolean }) => {
      if (vars.paraTodos) {
        const { error } = await supabase
          .from("mensagens")
          .update({
            excluida_em: new Date().toISOString(),
            excluida_para_todos: true,
            conteudo: "",
          })
          .eq("id", vars.id);
        if (error) throw error;
      } else if (uid) {
        const { error } = await supabase.from("mensagens_ocultas").insert({ user_id: uid, mensagem_id: vars.id });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => invalidate(v.conversaId),
    onError: (e: any) => toast.error("Erro ao excluir: " + e.message),
  });

  const togglePin = useMutation({
    mutationFn: async (vars: { id: string; conversaId: string; fixar: boolean }) => {
      const { error } = await supabase
        .from("mensagens")
        .update({
          fixada_em: vars.fixar ? new Date().toISOString() : null,
          fixada_por: vars.fixar ? uid : null,
        } as any)
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.conversaId),
  });

  const toggleReaction = useMutation({
    mutationFn: async (vars: { id: string; conversaId: string; emoji: string }) => {
      if (!uid) throw new Error("não autenticado");
      const { data: existing } = await supabase
        .from("mensagens_reacoes")
        .select("id")
        .eq("mensagem_id", vars.id)
        .eq("user_id", uid)
        .eq("emoji", vars.emoji)
        .maybeSingle();
      if (existing) {
        await supabase.from("mensagens_reacoes").delete().eq("id", existing.id);
      } else {
        await supabase.from("mensagens_reacoes").insert([{
          mensagem_id: vars.id,
          conversa_id: vars.conversaId,
          user_id: uid,
          emoji: vars.emoji,
        }]);
      }
    },
    onSuccess: (_d, v) => invalidate(v.conversaId),
  });

  const toggleFavorita = useMutation({
    mutationFn: async (vars: { id: string; conversaId: string; favorita: boolean }) => {
      if (!uid) return;
      if (vars.favorita) {
        await supabase.from("mensagens_favoritas").delete().eq("user_id", uid).eq("mensagem_id", vars.id);
      } else {
        await supabase.from("mensagens_favoritas").insert([{
          user_id: uid,
          mensagem_id: vars.id,
          conversa_id: vars.conversaId,
        }]);
      }
    },
    onSuccess: (_d, v) => invalidate(v.conversaId),
  });

  const marcarLido = useMutation({
    mutationFn: async (vars: { conversaId: string; ateMensagemId?: string }) => {
      const { error } = await supabase.rpc("rpc_chat_marcar_lido", {
        p_conversa_id: vars.conversaId,
        p_ate_mensagem_id: vars.ateMensagemId ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.conversaId),
  });

  const setParticipanteFlag = useMutation({
    mutationFn: async (vars: {
      conversaId: string;
      patch: Partial<{ favorita: boolean; arquivada: boolean; silenciada_ate: string | null; notificacoes_on: boolean }>;
    }) => {
      if (!uid) return;
      const { error } = await supabase
        .from("conversas_participantes")
        .update(vars.patch)
        .eq("conversa_id", vars.conversaId)
        .eq("usuario_id", uid);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.conversaId),
  });

  const criarConversaPrivada = useMutation({
    mutationFn: async (outroUserId: string): Promise<string> => {
      if (!uid) throw new Error("não autenticado");
      // procura conversa privada existente entre os 2
      const { data: minhas } = await supabase
        .from("conversas_participantes")
        .select("conversa_id")
        .eq("usuario_id", uid)
        .is("saiu_em", null);
      const ids = (minhas ?? []).map((m) => m.conversa_id);
      if (ids.length) {
        const { data: dele } = await supabase
          .from("conversas_participantes")
          .select("conversa_id")
          .eq("usuario_id", outroUserId)
          .in("conversa_id", ids)
          .is("saiu_em", null);
        if (dele && dele.length) {
          // verifica que é privada (somente 2 participantes)
          for (const r of dele) {
            const { count } = await supabase
              .from("conversas_participantes")
              .select("*", { count: "exact", head: true })
              .eq("conversa_id", r.conversa_id)
              .is("saiu_em", null);
            if (count === 2) return r.conversa_id;
          }
        }
      }
      const { data, error } = await supabase.rpc("rpc_chat_criar_conversa_privada" as any, {
        p_outro_user_id: outroUserId,
      } as any);
      if (error) throw error;
      if (!data) throw new Error("Não foi possível localizar a conversa criada");
      qc.invalidateQueries({ queryKey: ["chat", "conversas"] });
      return data as unknown as string;
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const criarGrupo = useMutation({
    mutationFn: async (vars: { nome: string; descricao?: string; avatar_url?: string; participantes: string[] }): Promise<string> => {
      const { data, error } = await supabase.rpc("rpc_chat_criar_grupo", {
        p_nome: vars.nome,
        p_descricao: vars.descricao ?? null,
        p_avatar_url: vars.avatar_url ?? null,
        p_participantes: vars.participantes,
      } as any);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["chat", "conversas"] });
      return data as unknown as string;
    },
    onError: (e: any) => toast.error("Erro ao criar grupo: " + e.message),
  });

  const sairGrupo = useMutation({
    mutationFn: async (conversaId: string) => {
      const { error } = await supabase.rpc("rpc_chat_sair_grupo", { p_conversa_id: conversaId } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", "conversas"] }),
  });

  const adicionarParticipantes = useMutation({
    mutationFn: async (vars: { conversaId: string; users: string[] }) => {
      const { error } = await supabase.rpc("rpc_chat_adicionar_participantes", {
        p_conversa_id: vars.conversaId,
        p_users: vars.users,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.conversaId),
  });

  const removerParticipante = useMutation({
    mutationFn: async (vars: { conversaId: string; user: string }) => {
      const { error } = await supabase.rpc("rpc_chat_remover_participante", {
        p_conversa_id: vars.conversaId,
        p_user: vars.user,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.conversaId),
  });

  return {
    sendMessage,
    editMessage,
    deleteMessage,
    togglePin,
    toggleReaction,
    toggleFavorita,
    marcarLido,
    setParticipanteFlag,
    criarConversaPrivada,
    criarGrupo,
    sairGrupo,
    adicionarParticipantes,
    removerParticipante,
  };
}
