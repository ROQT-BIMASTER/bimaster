import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isToday, addDays, isBefore, startOfDay } from "date-fns";
import { parseLocalDate, getToday } from "@/lib/utils/parseLocalDate";
import { isSemDatasPlanejadas } from "@/lib/utils/tarefaPlanejamento";
import { uniqueChannelName } from "@/lib/realtime/channelName";
import { logger } from "@/lib/logger";

export interface MinaTarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string | null;
  data_inicio_planejada: string | null;
  data_prazo: string | null;
  data_conclusao: string | null;
  projeto_id: string;
  projeto_nome: string;
  projeto_cor: string;
  estagio: string | null;
  criador_id: string | null;
  visibilidade: string | null;
  secao_id: string | null;
  secao_nome: string | null;
  ordem: number;
  parent_tarefa_id: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  responsavel_avatar_url: string | null;
  codigo: string | null;
  produto_id: string | null;
  created_at: string;
  updated_at: string;
  papel: "responsavel" | "colaborador" | "seguidor";
}

export interface TarefaGroup {
  label: string;
  key: string;
  items: MinaTarefa[];
}

export function useMinhasTarefas() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["minhas-tarefas", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await (supabase as any)
        .rpc("get_minhas_tarefas_central");

      if (error) throw error;

      return ((data || []) as any[]).map((t): MinaTarefa => ({
        id: t.id,
        titulo: t.titulo,
        descricao: t.descricao || null,
        status: t.status,
        prioridade: t.prioridade,
        data_inicio_planejada: t.data_inicio_planejada,
        data_prazo: t.data_prazo,
        data_conclusao: t.data_conclusao,
        projeto_id: t.projeto_id,
        projeto_nome: t.projeto_nome || "Sem projeto",
        projeto_cor: t.projeto_cor || "#6366f1",
        estagio: t.estagio,
        criador_id: t.criador_id,
        visibilidade: t.visibilidade,
        secao_id: t.secao_id as string | null,
        secao_nome: t.secao_nome || null,
        ordem: t.ordem || 0,
        parent_tarefa_id: t.parent_tarefa_id || null,
        responsavel_id: t.responsavel_id || null,
        responsavel_nome: t.responsavel_nome || null,
        responsavel_avatar_url: t.responsavel_avatar_url || null,
        codigo: t.codigo || null,
        produto_id: t.produto_id || null,
        created_at: t.created_at,
        updated_at: t.updated_at,
        papel: t.papel === "colaborador" ? "colaborador" : "responsavel",
      }));
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });

  // Realtime: invalida a lista quando qualquer tarefa muda OU quando o usuário
  // é adicionado/removido como responsável ou colaborador em outro ambiente.
  // Debounce de 250ms coalesce rajadas (criação em lote, edição de equipe).
  // Falhas de canal são silenciosas — a query continua funcionando manualmente
  // e na refocagem da janela. Mantém o comportamento atual em produção como
  // fallback caso o realtime esteja indisponível.
  useEffect(() => {
    if (!user?.id) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const invalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // refetchType:"none" evita "flash" de loading em consumidores ativos —
        // a próxima leitura (foco/next render) resolve o dado atualizado.
        qc.invalidateQueries({ queryKey: ["minhas-tarefas", user.id], refetchType: "none" });
      }, 250);
    };


    const channelName = uniqueChannelName(`minhas-tarefas-rt:${user.id}`);
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projeto_tarefas" },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projeto_tarefa_responsaveis",
          filter: `user_id=eq.${user.id}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projeto_tarefa_colaboradores",
          filter: `user_id=eq.${user.id}`,
        },
        invalidate,
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          logger.warn(`[useMinhasTarefas] Realtime status=${status}`, { error: err });
          // Canal caiu: garante que a próxima leitura ativa não usa cache stale.
          qc.invalidateQueries({ queryKey: ["minhas-tarefas", user.id], refetchType: "active" });
        }
      });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [user?.id, qc]);

  return query;
}

export function groupTarefas(tarefas: MinaTarefa[]): TarefaGroup[] {
  // `getToday()` retorna meia-noite no fuso America/Sao_Paulo,
  // garantindo classificação correta de Atrasadas/Hoje/Esta semana
  // independente do fuso do navegador ou do servidor.
  const now = getToday();
  const nextWeek = addDays(now, 7);

  const atrasadas: MinaTarefa[] = [];
  const hoje: MinaTarefa[] = [];
  const estaSemana: MinaTarefa[] = [];
  const maisAdiante: MinaTarefa[] = [];
  const semData: MinaTarefa[] = [];
  const concluidas: MinaTarefa[] = [];

  for (const t of tarefas) {
    if (t.status === "concluida") {
      concluidas.push(t);
      continue;
    }

    // Tarefas sem planejamento completo (sem início OU sem prazo) entram no
    // grupo "Sem datas planejadas" — preserva o alerta histórico do produto.
    if (isSemDatasPlanejadas(t)) {
      semData.push(t);
      continue;
    }

    const prazo = startOfDay(parseLocalDate(t.data_prazo) ?? now);

    if (isBefore(prazo, now)) {
      atrasadas.push(t);
    } else if (isToday(prazo)) {
      hoje.push(t);
    } else if (isBefore(prazo, nextWeek)) {
      estaSemana.push(t);
    } else {
      maisAdiante.push(t);
    }
  }

  return [
    { label: "Atrasadas", key: "atrasadas", items: atrasadas },
    { label: "A fazer hoje", key: "hoje", items: hoje },
    { label: "A fazer esta semana", key: "semana", items: estaSemana },
    { label: "A fazer mais tarde", key: "mais_tarde", items: maisAdiante },
    { label: "Sem datas planejadas", key: "sem_data", items: semData },
    { label: "Concluídas recentemente", key: "concluidas", items: concluidas.slice(0, 5) },
  ].filter(g => g.items.length > 0);
}
