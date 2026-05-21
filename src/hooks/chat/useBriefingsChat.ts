/**
 * useBriefingsChat — carrega briefings acessíveis ao usuário pra exibição
 * na sidebar do chat corporativo (modo "Briefing"). Análogo a
 * useChinaSubmissoesChat: cada briefing vira um "contato".
 *
 * Retorna por briefing: dados básicos, última atividade (último comentário
 * ou mensagem de chat — o mais recente), contagem de não-lidos e contagem
 * de menções diretas ao usuário atual.
 *
 * "Não-lido" = comentário criado após o `last_read_at` do membro no
 * briefing. Admin/gerente que não é membro não recebe contagem (não tem
 * registro de last_read_at).
 */
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export interface BriefingChatItem {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  completude: number;
  projeto_id: string | null;
  created_at: string;
  updated_at: string | null;
  ultimaAtividade: {
    fonte: "comentario" | "mensagem";
    texto: string;
    autor_nome: string | null;
    created_at: string;
    campo_key?: string | null;
  } | null;
  naoLidos: number;
  mencoesAbertas: number;
}

export function filtrarBriefingsChat(
  list: BriefingChatItem[],
  busca: string,
  filtro: "todos" | "nao_lidos" | "mencoes" | "resolvidos" = "todos",
): BriefingChatItem[] {
  let r = list;
  if (filtro === "nao_lidos") r = r.filter((b) => b.naoLidos > 0);
  if (filtro === "mencoes") r = r.filter((b) => b.mencoesAbertas > 0);
  if (filtro === "resolvidos") r = r.filter((b) => b.status === "aprovado" || b.status === "concluido");
  const q = busca.trim().toLowerCase();
  if (!q) return r;
  return r.filter(
    (b) =>
      b.titulo.toLowerCase().includes(q) ||
      b.tipo.toLowerCase().includes(q) ||
      (b.ultimaAtividade?.texto ?? "").toLowerCase().includes(q),
  );
}

export function useBriefingsChat() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const queryKey = ["chat-briefings", userId];

  const query = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<BriefingChatItem[]> => {
      if (!userId) return [];

      // 1) Briefings acessíveis (RLS filtra automaticamente).
      const { data: briefs, error } = await supabase
        .from("briefings")
        .select("id, titulo, tipo, status, completude, projeto_id, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      if (!briefs?.length) return [];

      const ids = briefs.map((b: any) => b.id);

      // 2) last_read_at do usuário em cada briefing (pra calcular não-lidos).
      const { data: membros } = await (supabase as any)
        .from("briefing_membros")
        .select("briefing_id, last_read_at")
        .eq("user_id", userId)
        .in("briefing_id", ids);
      const lastReadBy = new Map<string, string>();
      (membros ?? []).forEach((m: any) => lastReadBy.set(m.briefing_id, m.last_read_at));

      // 3) Comentários por briefing — pega últimos N, agrupa no cliente.
      const { data: coments } = await (supabase as any)
        .from("briefing_comentarios")
        .select("id, briefing_id, campo_key, author_id, body, mentions, resolved, created_at")
        .in("briefing_id", ids)
        .order("created_at", { ascending: false })
        .limit(ids.length * 8);

      // 4) Mensagens (chat IA) — só pra preview da última atividade.
      const { data: msgs } = await (supabase as any)
        .from("briefing_mensagens")
        .select("briefing_id, content, role, created_at")
        .in("briefing_id", ids)
        .order("created_at", { ascending: false })
        .limit(ids.length * 3);

      // 5) Profiles dos autores (pra preview "Fulano: …").
      const authorIds = Array.from(
        new Set((coments ?? []).map((c: any) => c.author_id).filter(Boolean)),
      ) as string[];
      const profilesMap = new Map<string, string>();
      if (authorIds.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, nome")
          .in("id", authorIds);
        (profs ?? []).forEach((p: any) => profilesMap.set(p.id, p.nome ?? null));
      }

      // Agrupa por briefing
      const lastComentBySub = new Map<string, any>();
      const naoLidosBySub = new Map<string, number>();
      const mencoesBySub = new Map<string, number>();
      (coments ?? []).forEach((c: any) => {
        // Fallback: usuários sem registro em briefing_membros (ex.: admins/gerentes
        // que acessam via RLS sem ser membros) tratam "nunca lido" como epoch,
        // garantindo que comentários e menções apareçam normalmente.
        const lr = lastReadBy.get(c.briefing_id) ?? "1970-01-01T00:00:00Z";
        const isNovo = c.created_at > lr;
        const ehDeOutro = c.author_id && c.author_id !== userId;
        if (isNovo && ehDeOutro) {
          naoLidosBySub.set(c.briefing_id, (naoLidosBySub.get(c.briefing_id) ?? 0) + 1);
        }
        const ehMencaoAMim =
          ehDeOutro &&
          !c.resolved &&
          c.created_at > lr &&
          Array.isArray(c.mentions) &&
          c.mentions.includes(userId);
        if (ehMencaoAMim) {
          mencoesBySub.set(c.briefing_id, (mencoesBySub.get(c.briefing_id) ?? 0) + 1);
        }
        if (!lastComentBySub.has(c.briefing_id)) lastComentBySub.set(c.briefing_id, c);
      });

      const lastMsgBySub = new Map<string, any>();
      (msgs ?? []).forEach((m: any) => {
        if (!lastMsgBySub.has(m.briefing_id)) lastMsgBySub.set(m.briefing_id, m);
      });

      return (briefs as any[]).map((b) => {
        const c = lastComentBySub.get(b.id);
        const m = lastMsgBySub.get(b.id);
        let ultimaAtividade: BriefingChatItem["ultimaAtividade"] = null;
        if (c && (!m || c.created_at >= m.created_at)) {
          ultimaAtividade = {
            fonte: "comentario",
            texto: c.body,
            autor_nome: profilesMap.get(c.author_id) ?? null,
            created_at: c.created_at,
            campo_key: c.campo_key,
          };
        } else if (m) {
          ultimaAtividade = {
            fonte: "mensagem",
            texto: m.content ?? "",
            autor_nome: m.role === "assistant" ? "IA" : null,
            created_at: m.created_at,
          };
        }
        return {
          id: b.id,
          titulo: b.titulo,
          tipo: b.tipo,
          status: b.status,
          completude: b.completude ?? 0,
          projeto_id: b.projeto_id,
          created_at: b.created_at,
          updated_at: b.updated_at,
          ultimaAtividade,
          naoLidos: naoLidosBySub.get(b.id) ?? 0,
          mencoesAbertas: mencoesBySub.get(b.id) ?? 0,
        } satisfies BriefingChatItem;
      });
    },
  });

  // Realtime — invalida quando há comentário ou mensagem nova
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(uniqueChannelName(`chat-briefings-${userId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "briefing_comentarios" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "briefing_mensagens" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
}

export async function marcarBriefingLido(briefingId: string) {
  await (supabase as any).rpc("rpc_briefing_marcar_lido", { p_briefing_id: briefingId });
}
