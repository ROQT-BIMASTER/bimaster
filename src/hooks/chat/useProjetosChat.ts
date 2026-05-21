/**
 * useProjetosChat — carrega projetos acessíveis ao usuário para exibição
 * na sidebar do Chat corporativo (modo "Projetos"). Espelho de
 * useBriefingsChat: cada projeto vira um "contato" com preview da última
 * atividade (chat geral OU comentário em tarefa, o mais recente), contagem
 * de não-lidos e contagem de menções diretas ao usuário.
 *
 * "Não-lido" = mensagem/comentário criado após o `last_read_at` do
 * `projeto_membros` do usuário. Quem não é membro não recebe contagem
 * (admin/gerente sem membership veem 0).
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uniqueChannelName } from "@/lib/realtime/channelName";

export interface ProjetoChatItem {
  id: string;
  nome: string;
  status: string;
  cor: string | null;
  criador_id: string;
  created_at: string;
  updated_at: string | null;
  ultimaAtividade: {
    fonte: "chat" | "tarefa";
    texto: string;
    autor_nome: string | null;
    created_at: string;
    tarefa_titulo?: string | null;
  } | null;
  naoLidos: number;
  mencoesAbertas: number;
}

export function filtrarProjetosChat(
  list: ProjetoChatItem[],
  busca: string,
  filtro: "todos" | "nao_lidos" | "mencoes" | "concluidos" = "todos",
): ProjetoChatItem[] {
  let r = list;
  if (filtro === "nao_lidos") r = r.filter((p) => p.naoLidos > 0);
  if (filtro === "mencoes") r = r.filter((p) => p.mencoesAbertas > 0);
  if (filtro === "concluidos")
    r = r.filter((p) => p.status === "concluido" || p.status === "arquivado");
  const q = busca.trim().toLowerCase();
  if (!q) return r;
  return r.filter(
    (p) =>
      p.nome.toLowerCase().includes(q) ||
      (p.ultimaAtividade?.texto ?? "").toLowerCase().includes(q),
  );
}

export function useProjetosChat() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const queryKey = ["chat-projetos", userId];

  const query = useQuery({
    queryKey,
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<ProjetoChatItem[]> => {
      if (!userId) return [];

      // 1) Projetos acessíveis (RLS filtra automaticamente).
      const { data: projetos, error } = await supabase
        .from("projetos")
        .select("id, nome, status, cor, criador_id, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      if (!projetos?.length) return [];

      const ids = projetos.map((p: any) => p.id);

      // 2) last_read_at do usuário em cada projeto.
      const { data: membros } = await (supabase as any)
        .from("projeto_membros")
        .select("projeto_id, last_read_at")
        .eq("user_id", userId)
        .in("projeto_id", ids);
      const lastReadBy = new Map<string, string>();
      (membros ?? []).forEach((m: any) =>
        lastReadBy.set(m.projeto_id, m.last_read_at),
      );

      // 3) Mensagens do chat geral por projeto — últimas N agregadas.
      const { data: msgs } = await (supabase as any)
        .from("projeto_chat_messages")
        .select("id, projeto_id, user_id, conteudo, tipo, mentions, created_at")
        .in("projeto_id", ids)
        .eq("tipo", "mensagem")
        .order("created_at", { ascending: false })
        .limit(ids.length * 8);

      // 4) Comentários de tarefas — primeiro pega tarefas dos projetos,
      //    depois comentários dessas tarefas. Mais barato que JOIN no PostgREST.
      const { data: tarefas } = await (supabase as any)
        .from("projeto_tarefas")
        .select("id, projeto_id, titulo")
        .in("projeto_id", ids);
      const tarefaToProjeto = new Map<string, string>();
      const tarefaToTitulo = new Map<string, string>();
      (tarefas ?? []).forEach((t: any) => {
        tarefaToProjeto.set(t.id, t.projeto_id);
        tarefaToTitulo.set(t.id, t.titulo);
      });
      const tarefaIds = (tarefas ?? []).map((t: any) => t.id);

      let coments: any[] = [];
      if (tarefaIds.length) {
        const { data } = await (supabase as any)
          .from("projeto_tarefa_comentarios")
          .select("id, tarefa_id, user_id, conteudo, mentions, created_at")
          .in("tarefa_id", tarefaIds)
          .order("created_at", { ascending: false })
          .limit(tarefaIds.length * 2);
        coments = data ?? [];
      }

      // 5) Profiles dos autores envolvidos.
      const authorIds = Array.from(
        new Set(
          [
            ...(msgs ?? []).map((m: any) => m.user_id),
            ...coments.map((c: any) => c.user_id),
          ].filter(Boolean),
        ),
      ) as string[];
      const profilesMap = new Map<string, string | null>();
      if (authorIds.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, nome")
          .in("id", authorIds);
        (profs ?? []).forEach((p: any) =>
          profilesMap.set(p.id, p.nome ?? null),
        );
      }

      // 6) Agrupa por projeto: última atividade, não-lidos, menções.
      const lastByProj = new Map<
        string,
        { fonte: "chat" | "tarefa"; texto: string; autor: string | null; created_at: string; tarefa_titulo?: string | null }
      >();
      const naoLidosByProj = new Map<string, number>();
      const mencoesByProj = new Map<string, number>();

      const consider = (
        projetoId: string,
        item: { texto: string; autor: string | null; created_at: string; mentions?: string[]; user_id?: string | null; fonte: "chat" | "tarefa"; tarefa_titulo?: string | null },
      ) => {
        // Fallback: usuários sem registro em projeto_membros (admins/gerentes
        // sem membership formal) tratam "nunca lido" como epoch para que
        // não-lidos e menções apareçam normalmente.
        const lr = lastReadBy.get(projetoId) ?? "1970-01-01T00:00:00Z";
        const isNovo = item.created_at > lr;
        const ehDeOutro = !!item.user_id && item.user_id !== userId;
        if (isNovo && ehDeOutro) {
          naoLidosByProj.set(projetoId, (naoLidosByProj.get(projetoId) ?? 0) + 1);
        }
        const ehMencaoAMim =
          ehDeOutro &&
          item.created_at > lr &&
          Array.isArray(item.mentions) &&
          item.mentions.includes(userId);
        if (ehMencaoAMim) {
          mencoesByProj.set(projetoId, (mencoesByProj.get(projetoId) ?? 0) + 1);
        }
        const current = lastByProj.get(projetoId);
        if (!current || item.created_at > current.created_at) {
          lastByProj.set(projetoId, {
            fonte: item.fonte,
            texto: item.texto,
            autor: item.autor,
            created_at: item.created_at,
            tarefa_titulo: item.tarefa_titulo ?? null,
          });
        }
      };

      (msgs ?? []).forEach((m: any) => {
        consider(m.projeto_id, {
          fonte: "chat",
          texto: m.conteudo ?? "",
          autor: m.user_id ? profilesMap.get(m.user_id) ?? null : null,
          created_at: m.created_at,
          mentions: m.mentions ?? [],
          user_id: m.user_id,
        });
      });

      coments.forEach((c: any) => {
        const projetoId = tarefaToProjeto.get(c.tarefa_id);
        if (!projetoId) return;
        consider(projetoId, {
          fonte: "tarefa",
          texto: c.conteudo ?? "",
          autor: c.user_id ? profilesMap.get(c.user_id) ?? null : null,
          created_at: c.created_at,
          mentions: c.mentions ?? [],
          user_id: c.user_id,
          tarefa_titulo: tarefaToTitulo.get(c.tarefa_id) ?? null,
        });
      });

      return (projetos as any[]).map((p) => {
        const last = lastByProj.get(p.id);
        return {
          id: p.id,
          nome: p.nome,
          status: p.status,
          cor: p.cor,
          criador_id: p.criador_id,
          created_at: p.created_at,
          updated_at: p.updated_at,
          ultimaAtividade: last
            ? {
                fonte: last.fonte,
                texto: last.texto,
                autor_nome: last.autor,
                created_at: last.created_at,
                tarefa_titulo: last.tarefa_titulo,
              }
            : null,
          naoLidos: naoLidosByProj.get(p.id) ?? 0,
          mencoesAbertas: mencoesByProj.get(p.id) ?? 0,
        } satisfies ProjetoChatItem;
      });
    },
  });

  // Realtime — invalida quando há mensagem nova ou comentário novo.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(uniqueChannelName(`chat-projetos-${userId}`))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projeto_chat_messages" },
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
  }, [userId, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
}

export async function marcarProjetoLido(projetoId: string) {
  await (supabase as any).rpc("rpc_projeto_marcar_lido", {
    p_projeto_id: projetoId,
  });
}
