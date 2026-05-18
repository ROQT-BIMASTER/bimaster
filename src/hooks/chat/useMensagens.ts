import { useEffect, useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import type { ChatAnexo, ChatLeitura, ChatMensagem, ChatProfile, ChatReacao } from "./types";

const PAGE = 50;

async function loadMensagensBatch(conversaId: string, beforeIso: string | null): Promise<ChatMensagem[]> {
  let q = supabase
    .from("mensagens")
    .select("id, conversa_id, remetente_id, conteudo, tipo, responde_a_id, encaminhada_de_id, editada_em, excluida_em, excluida_para_todos, fixada_em, mencoes, metadata, created_at")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: false })
    .limit(PAGE);
  if (beforeIso) q = q.lt("created_at", beforeIso);
  const { data, error } = await q;
  if (error) throw error;
  const list = (data ?? []) as ChatMensagem[];
  if (list.length === 0) return [];

  const ids = list.map((m) => m.id);
  const senderIds = Array.from(new Set(list.map((m) => m.remetente_id))).filter(Boolean);
  const replyIds = list.map((m) => m.responde_a_id).filter(Boolean) as string[];

  const [profsRes, anexosRes, reacoesRes, leitRes, repliesRes] = await Promise.all([
    // chat_directory bypassa a RLS estrita de profiles — sem isso, mensagens
    // de outros usuários apareceriam sem nome/avatar para não-admins.
    senderIds.length
      ? supabase.from("chat_directory" as any).select("id, nome, avatar_url").in("id", senderIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("mensagens_anexos").select("*").in("mensagem_id", ids),
    supabase.from("mensagens_reacoes").select("id, mensagem_id, emoji, user_id").in("mensagem_id", ids),
    supabase.from("mensagens_leituras").select("mensagem_id, user_id, lida_em").in("mensagem_id", ids),
    replyIds.length
      ? supabase.from("mensagens").select("id, conteudo, remetente_id, tipo").in("id", replyIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const profMap = new Map<string, ChatProfile>((profsRes.data ?? []).map((p: any) => [p.id, p]));
  const anexosMap = new Map<string, ChatAnexo[]>();
  (anexosRes.data ?? []).forEach((a: any) => {
    const arr = anexosMap.get(a.mensagem_id) ?? [];
    arr.push(a);
    anexosMap.set(a.mensagem_id, arr);
  });
  const reacoesMap = new Map<string, ChatReacao[]>();
  (reacoesRes.data ?? []).forEach((r: any) => {
    const arr = reacoesMap.get(r.mensagem_id) ?? [];
    arr.push({ id: r.id, emoji: r.emoji, user_id: r.user_id });
    reacoesMap.set(r.mensagem_id, arr);
  });
  const leitMap = new Map<string, ChatLeitura[]>();
  (leitRes.data ?? []).forEach((l: any) => {
    const arr = leitMap.get(l.mensagem_id) ?? [];
    arr.push({ user_id: l.user_id, lida_em: l.lida_em });
    leitMap.set(l.mensagem_id, arr);
  });
  const replyMap = new Map<string, any>((repliesRes.data ?? []).map((r: any) => [r.id, r]));

  // Resolve profiles dos remetentes das mensagens citadas (responde_a)
  // que ainda não estão no profMap (ex: usuário enviou no passado mas
  // não nas últimas 50 mensagens). Sem isso, o quote do reply mostraria
  // só o conteúdo sem identificar quem mandou.
  const replySenderIds = Array.from(
    new Set(
      (repliesRes.data ?? [])
        .map((r: any) => r.remetente_id)
        .filter((id: string | null) => id && !profMap.has(id)),
    ),
  ) as string[];
  if (replySenderIds.length) {
    const { data: extraProfs } = await supabase
      .from("chat_directory" as any)
      .select("id, nome, avatar_url")
      .in("id", replySenderIds);
    (extraProfs ?? []).forEach((p: any) => profMap.set(p.id, p));
  }

  return list.map((m) => {
    const replyRaw = m.responde_a_id ? replyMap.get(m.responde_a_id) : null;
    const respondeA = replyRaw
      ? {
          ...replyRaw,
          remetente: profMap.get(replyRaw.remetente_id) ?? null,
        }
      : null;
    return {
      ...m,
      mencoes: (m.mencoes as any) ?? [],
      metadata: (m.metadata as any) ?? {},
      remetente: profMap.get(m.remetente_id) ?? null,
      responde_a: respondeA,
      anexos: anexosMap.get(m.id) ?? [],
      reacoes: reacoesMap.get(m.id) ?? [],
      leituras: leitMap.get(m.id) ?? [],
    };
  });
}

export function useMensagens(conversaId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["chat", "mensagens", conversaId];

  const query = useInfiniteQuery({
    queryKey,
    enabled: !!conversaId,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => loadMensagensBatch(conversaId!, pageParam),
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1].created_at : undefined),
  });

  // Realtime
  useEffect(() => {
    if (!conversaId) return;
    const ch = supabase
      .channel(uniqueChannelName(`chat-msg-${conversaId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens", filter: `conversa_id=eq.${conversaId}` }, () => {
        qc.invalidateQueries({ queryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens_reacoes", filter: `conversa_id=eq.${conversaId}` }, () => {
        qc.invalidateQueries({ queryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens_leituras", filter: `conversa_id=eq.${conversaId}` }, () => {
        qc.invalidateQueries({ queryKey });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens_anexos", filter: `conversa_id=eq.${conversaId}` }, () => {
        qc.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversaId, qc]);

  // achata em ordem cronológica asc
  const mensagens = useMemo<ChatMensagem[]>(() => {
    const pages = query.data?.pages ?? [];
    const flat = pages.flat();
    return flat.slice().reverse();
  }, [query.data]);

  return { ...query, mensagens };
}

export function useConversaInfo(conversaId: string | null) {
  return useQuery({
    queryKey: ["chat", "conversa-info", conversaId],
    enabled: !!conversaId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!conversaId) return null;
      const { data: c } = await supabase.from("conversas").select("*").eq("id", conversaId).maybeSingle();
      const { data: parts } = await supabase
        .from("conversas_participantes")
        .select("usuario_id, papel, entrou_em, saiu_em")
        .eq("conversa_id", conversaId)
        .is("saiu_em", null);
      const ids = (parts ?? []).map((p) => p.usuario_id);
      const { data: profs } = ids.length
        ? await supabase.from("chat_directory" as any).select("id, nome, avatar_url").in("id", ids)
        : { data: [] as any[] };
      const profMap = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
      return {
        conversa: c,
        participantes: (parts ?? []).map((p) => ({ ...p, profile: profMap.get(p.usuario_id) ?? null })),
      };
    },
  });
}
