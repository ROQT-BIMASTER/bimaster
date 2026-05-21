/**
 * useProjetoComentariosAgg — agrega num único stream:
 *  - mensagens do chat geral do projeto (`projeto_chat_messages`), e
 *  - comentários de tarefas (`projeto_tarefa_comentarios`) com `tarefa_id`,
 *    `tarefa_titulo` e `tarefa_codigo` para link "Abrir tarefa".
 *
 * Cada item tem `origem: "chat_geral" | "tarefa"`. Lista ordenada desc por
 * `created_at`. Inclui realtime (invalida em INSERT/UPDATE em ambas as
 * tabelas). Não escreve — só leitura para o painel do Chat.
 */
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export interface ProjetoComentarioAgg {
  id: string;
  origem: "chat_geral" | "tarefa";
  user_id: string | null;
  autor_nome: string | null;
  autor_avatar: string | null;
  conteudo: string;
  mentions: string[];
  created_at: string;
  tarefaRef?: {
    id: string;
    titulo: string;
    codigo: string | null;
  };
}

export function useProjetoComentariosAgg(projetoId: string | null) {
  const qc = useQueryClient();
  const queryKey = ["projeto-comentarios-agg", projetoId];

  const query = useQuery({
    queryKey,
    enabled: !!projetoId,
    staleTime: 15_000,
    queryFn: async (): Promise<ProjetoComentarioAgg[]> => {
      if (!projetoId) return [];

      // 1) Mensagens do chat geral (excluindo resumos/sistema — esses ficam na aba Atividade).
      const { data: msgs } = await (supabase as any)
        .from("projeto_chat_messages")
        .select("id, user_id, conteudo, mentions, created_at, tipo")
        .eq("projeto_id", projetoId)
        .eq("tipo", "mensagem")
        .order("created_at", { ascending: false })
        .limit(200);

      // 2) Tarefas do projeto, para resolver os comentários.
      const { data: tarefas } = await (supabase as any)
        .from("projeto_tarefas")
        .select("id, titulo, codigo")
        .eq("projeto_id", projetoId);
      const tarefaMap = new Map<string, { id: string; titulo: string; codigo: string | null }>();
      (tarefas ?? []).forEach((t: any) =>
        tarefaMap.set(t.id, { id: t.id, titulo: t.titulo, codigo: t.codigo ?? null }),
      );
      const tarefaIds = Array.from(tarefaMap.keys());

      let coments: any[] = [];
      if (tarefaIds.length) {
        const { data } = await (supabase as any)
          .from("projeto_tarefa_comentarios")
          .select("id, tarefa_id, user_id, conteudo, mentions, created_at")
          .in("tarefa_id", tarefaIds)
          .order("created_at", { ascending: false })
          .limit(300);
        coments = data ?? [];
      }

      // 3) Profiles dos autores envolvidos.
      const authorIds = Array.from(
        new Set(
          [
            ...((msgs ?? []) as any[]).map((m) => m.user_id),
            ...coments.map((c) => c.user_id),
          ].filter(Boolean),
        ),
      ) as string[];
      const profMap = new Map<string, { nome: string | null; avatar_url: string | null }>();
      if (authorIds.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, nome, avatar_url")
          .in("id", authorIds);
        (profs ?? []).forEach((p: any) =>
          profMap.set(p.id, { nome: p.nome ?? null, avatar_url: p.avatar_url ?? null }),
        );
      }

      const itemsChat: ProjetoComentarioAgg[] = ((msgs ?? []) as any[]).map((m) => ({
        id: `msg-${m.id}`,
        origem: "chat_geral",
        user_id: m.user_id,
        autor_nome: m.user_id ? profMap.get(m.user_id)?.nome ?? null : null,
        autor_avatar: m.user_id ? profMap.get(m.user_id)?.avatar_url ?? null : null,
        conteudo: m.conteudo ?? "",
        mentions: m.mentions ?? [],
        created_at: m.created_at,
      }));

      const itemsTarefa: ProjetoComentarioAgg[] = coments.map((c: any) => ({
        id: `tc-${c.id}`,
        origem: "tarefa",
        user_id: c.user_id,
        autor_nome: c.user_id ? profMap.get(c.user_id)?.nome ?? null : null,
        autor_avatar: c.user_id ? profMap.get(c.user_id)?.avatar_url ?? null : null,
        conteudo: c.conteudo ?? "",
        mentions: c.mentions ?? [],
        created_at: c.created_at,
        tarefaRef: tarefaMap.get(c.tarefa_id),
      }));

      return [...itemsChat, ...itemsTarefa].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
    },
  });

  useEffect(() => {
    if (!projetoId) return;
    const ch = supabase
      .channel(uniqueChannelName(`projeto-coments-agg-${projetoId}`))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projeto_chat_messages",
          filter: `projeto_id=eq.${projetoId}`,
        },
        () => qc.invalidateQueries({ queryKey }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projeto_tarefa_comentarios" },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projetoId, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => query.data ?? [], [query.data]);
  return { ...query, data };
}
