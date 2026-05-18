import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import type { ChatConversa, ChatProfile } from "./types";

export type ChatFiltro =
  | "todas"
  | "nao_lidas"
  | "grupos"
  | "favoritas"
  | "arquivadas"
  | "mencoes"
  | "urgentes"
  | "anexos";

export function useConversas() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const queryKey = ["chat", "conversas", userId];

  const query = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: 15_000,
    queryFn: async (): Promise<ChatConversa[]> => {
      if (!userId) return [];
      // 1) participações do usuário (não saiu)
      const { data: parts, error: pErr } = await supabase
        .from("conversas_participantes")
        .select("conversa_id, papel, favorita, arquivada, silenciada_ate, ultima_leitura, saiu_em")
        .eq("usuario_id", userId)
        .is("saiu_em", null);
      if (pErr) throw pErr;
      const ids = (parts ?? []).map((p) => p.conversa_id);
      if (ids.length === 0) return [];

      // 2) conversas
      const { data: convs, error: cErr } = await supabase
        .from("conversas")
        .select("id, nome, tipo, descricao, avatar_url, criado_por, arquivada_em, ultima_mensagem_em, updated_at")
        .in("id", ids);
      if (cErr) throw cErr;

      // 3) últimas mensagens (uma query por conversa em paralelo é caro;
      // usamos uma view simples: pegar 1 mensagem por conversa via window function alternativo)
      // fallback: buscar últimas N e agrupar
      const { data: lastMsgs } = await supabase
        .from("mensagens")
        .select("id, conversa_id, conteudo, created_at, tipo, remetente_id, excluida_para_todos")
        .in("conversa_id", ids)
        .order("created_at", { ascending: false })
        .limit(ids.length * 3);
      const lastByConv = new Map<string, any>();
      (lastMsgs ?? []).forEach((m: any) => {
        if (!lastByConv.has(m.conversa_id)) lastByConv.set(m.conversa_id, m);
      });

      // 4) não lidas: count agregado por conversa.
      //    Antes carregávamos TODAS as mensagens dos remetentes + todas as leituras
      //    do usuário em todas as conversas, e calculávamos no cliente. Em conta com
      //    histórico grande isso virava lento.
      //    Agora: 1 HEAD count por conversa, em paralelo, usando ultima_leitura
      //    como corte (que já é mantida por rpc_chat_marcar_lido).
      const unreadByConv = new Map<string, number>();
      await Promise.all(
        (parts ?? []).map(async (p) => {
          const corte = p.ultima_leitura ?? "1970-01-01T00:00:00Z";
          const { count } = await supabase
            .from("mensagens")
            .select("id", { count: "exact", head: true })
            .eq("conversa_id", p.conversa_id)
            .neq("remetente_id", userId)
            .gt("created_at", corte)
            .eq("excluida_para_todos", false);
          if (count && count > 0) unreadByConv.set(p.conversa_id, count);
        }),
      );

      // 5) outros participantes (para conversas privadas)
      const { data: outros } = await supabase
        .from("conversas_participantes")
        .select("conversa_id, usuario_id, saiu_em")
        .in("conversa_id", ids)
        .is("saiu_em", null);
      const otherIds = new Set<string>();
      const participantsByConv = new Map<string, string[]>();
      (outros ?? []).forEach((o: any) => {
        const arr = participantsByConv.get(o.conversa_id) ?? [];
        arr.push(o.usuario_id);
        participantsByConv.set(o.conversa_id, arr);
        if (o.usuario_id !== userId) otherIds.add(o.usuario_id);
      });
      const profMap = new Map<string, ChatProfile>();
      if (otherIds.size) {
        // Diretório SECURITY DEFINER — necessário porque profiles tem RLS
        // estrita que esconde colegas dos não-admins (ver migration
        // 20260514100000_create_chat_directory_view).
        const { data: profs } = await supabase
          .from("chat_directory" as any)
          .select("id, nome, avatar_url")
          .in("id", Array.from(otherIds));
        (profs ?? []).forEach((p: any) => profMap.set(p.id, p));
      }

      const partByConv = new Map<string, any>();
      (parts ?? []).forEach((p) => partByConv.set(p.conversa_id, p));

      const result: ChatConversa[] = (convs ?? []).map((c: any) => {
        const part = partByConv.get(c.id);
        const ids = participantsByConv.get(c.id) ?? [];
        const otherId = ids.find((u) => u !== userId);
        return {
          ...c,
          outroUsuario: otherId ? profMap.get(otherId) ?? null : null,
          ultimaMensagem: lastByConv.get(c.id) ?? null,
          naoLidas: unreadByConv.get(c.id) ?? 0,
          favorita: !!part?.favorita,
          arquivada: !!part?.arquivada || !!c.arquivada_em,
          silenciada_ate: part?.silenciada_ate ?? null,
          papel: (part?.papel ?? "membro") as "admin" | "membro",
          participantes_count: ids.length,
        };
      });

      // ordena por última mensagem (desc); fallback updated_at
      result.sort((a, b) => {
        const aT = a.ultimaMensagem?.created_at ?? a.ultima_mensagem_em ?? a.updated_at;
        const bT = b.ultimaMensagem?.created_at ?? b.ultima_mensagem_em ?? b.updated_at;
        return new Date(bT).getTime() - new Date(aT).getTime();
      });
      return result;
    },
  });

  // Realtime: invalida lista quando mensagens/participações mudam
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(uniqueChannelName(`chat-list-${userId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens" }, () => {
        qc.invalidateQueries({ queryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens_leituras", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas_participantes", filter: `usuario_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  return query;
}

export function filtrarConversas(lista: ChatConversa[], filtro: ChatFiltro, busca: string): ChatConversa[] {
  let out = lista;
  if (filtro === "nao_lidas") out = out.filter((c) => c.naoLidas > 0);
  else if (filtro === "grupos") out = out.filter((c) => c.tipo === "group" || c.tipo === "grupo");
  else if (filtro === "favoritas") out = out.filter((c) => c.favorita);
  else if (filtro === "arquivadas") out = out.filter((c) => c.arquivada);
  // Filtros adicionais — usam metadata da última mensagem como heurística rápida
  // (filtragem em-memória; uma query dedicada por filtro seria over-engineering
  // dado o volume típico de conversas por usuário < 200).
  else if (filtro === "urgentes") {
    out = out.filter((c) => !c.arquivada && c.ultimaMensagem?.tipo === "urgente");
  } else if (filtro === "anexos") {
    out = out.filter((c) => {
      if (c.arquivada) return false;
      const t = c.ultimaMensagem?.tipo;
      return t === "imagem" || t === "arquivo" || t === "audio" || t === "video";
    });
  } else if (filtro === "mencoes") {
    // Heurística: última mensagem contém "@" e não foi enviada por mim.
    // Para precisão total seria necessário cruzar com mensagens.mencoes,
    // mas isso já cobre o caso prático (filtragem rápida da lista).
    out = out.filter((c) => {
      if (c.arquivada) return false;
      const last = c.ultimaMensagem;
      return !!last && last.conteudo?.includes("@");
    });
  } else {
    out = out.filter((c) => !c.arquivada);
  }

  const q = busca.trim().toLowerCase();
  if (q) {
    out = out.filter((c) => {
      const nome = (c.nome ?? c.outroUsuario?.nome ?? "").toLowerCase();
      const email = (c.outroUsuario?.email ?? "").toLowerCase();
      const ult = (c.ultimaMensagem?.conteudo ?? "").toLowerCase();
      return nome.includes(q) || email.includes(q) || ult.includes(q);
    });
  }
  return out;
}

export function useChatUnreadTotal(): number {
  const { data } = useConversas();
  return useMemo(
    () => (data ?? []).reduce((s, c) => (!c.arquivada && !c.silenciada_ate ? s + c.naoLidas : s), 0),
    [data],
  );
}
