/**
 * useChinaSubmissoesChat — carrega submissões China pra exibição na sidebar
 * do chat corporativo (modo "Submissões"). Faz papel análogo ao `useConversas`
 * mas pra tabelas `china_produto_submissoes` + `china_chat_mensagens`.
 *
 * Retorna por submissão: dados básicos, última mensagem do chat,
 * contagem de não-lidas (mensagens onde o user atual não está em `lida_por`).
 */
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export interface ChinaSubmissaoChatItem {
  id: string;
  produto_codigo: string | null;
  produto_nome: string | null;
  chat_status: string | null;
  numero_ordem: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
  ultimaMensagem: {
    conteudo: string;
    tipo: string;
    created_at: string;
  } | null;
  naoLidas: number;
}

export function useChinaSubmissoesChat() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const queryKey = ["chat-china-submissoes", userId];

  const query = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<ChinaSubmissaoChatItem[]> => {
      if (!userId) return [];

      // 1) Submissões visíveis ao usuário (RLS já filtra).
      //    Limite alto + ordenação por updated_at desc.
      const { data: subs, error } = await supabase
        .from("china_produto_submissoes")
        .select(
          "id, produto_codigo, produto_nome, chat_status, numero_ordem, status, created_at, updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      if (!subs?.length) return [];

      const ids = subs.map((s) => s.id);

      // 2) Última mensagem por submissão — heurística: pega últimas N mensagens
      //    no total, agrupa no cliente. Sem RPC dedicado pra evitar
      //    over-engineering nesta fase.
      const { data: lastMsgs } = await supabase
        .from("china_chat_mensagens")
        .select("submissao_id, conteudo, tipo, created_at")
        .in("submissao_id", ids)
        .order("created_at", { ascending: false })
        .limit(ids.length * 3);

      const lastBySub = new Map<string, ChinaSubmissaoChatItem["ultimaMensagem"]>();
      (lastMsgs ?? []).forEach((m: any) => {
        if (!lastBySub.has(m.submissao_id)) {
          lastBySub.set(m.submissao_id, {
            conteudo: m.conteudo,
            tipo: m.tipo,
            created_at: m.created_at,
          });
        }
      });

      // 3) Não-lidas — carrega `lida_por` de todas as mensagens das submissões
      //    e conta no cliente. Funciona pra ~200 submissões / ~poucos milhares
      //    de mensagens. Se ficar lento, vira RPC com agregação no banco.
      const { data: allMsgs } = await supabase
        .from("china_chat_mensagens")
        .select("id, submissao_id, lida_por, usuario_id")
        .in("submissao_id", ids);

      const unreadBySub = new Map<string, number>();
      (allMsgs ?? []).forEach((m: any) => {
        // Não conta as próprias mensagens
        if (m.usuario_id === userId) return;
        const lidaPor = Array.isArray(m.lida_por) ? m.lida_por : [];
        if (!lidaPor.includes(userId)) {
          unreadBySub.set(m.submissao_id, (unreadBySub.get(m.submissao_id) ?? 0) + 1);
        }
      });

      // 4) Monta e ordena: por última mensagem (desc), depois updated_at.
      const result = (subs ?? []).map((s: any) => ({
        id: s.id,
        produto_codigo: s.produto_codigo,
        produto_nome: s.produto_nome,
        chat_status: s.chat_status,
        numero_ordem: s.numero_ordem,
        status: s.status,
        created_at: s.created_at,
        updated_at: s.updated_at,
        ultimaMensagem: lastBySub.get(s.id) ?? null,
        naoLidas: unreadBySub.get(s.id) ?? 0,
      }));

      result.sort((a, b) => {
        const aT = a.ultimaMensagem?.created_at ?? a.updated_at ?? a.created_at;
        const bT = b.ultimaMensagem?.created_at ?? b.updated_at ?? b.created_at;
        return new Date(bT).getTime() - new Date(aT).getTime();
      });

      return result;
    },
  });

  // Realtime: invalida lista quando china_chat_mensagens muda.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(uniqueChannelName(`chat-china-list-${userId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_chat_mensagens" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  return query;
}

export function filtrarSubmissoesChat(
  lista: ChinaSubmissaoChatItem[],
  busca: string,
): ChinaSubmissaoChatItem[] {
  const q = busca.trim().toLowerCase();
  if (!q) return lista;
  return lista.filter((s) => {
    const codigo = (s.produto_codigo ?? "").toLowerCase();
    const nome = (s.produto_nome ?? "").toLowerCase();
    const num = (s.numero_ordem ?? "").toLowerCase();
    const ult = (s.ultimaMensagem?.conteudo ?? "").toLowerCase();
    return codigo.includes(q) || nome.includes(q) || num.includes(q) || ult.includes(q);
  });
}
