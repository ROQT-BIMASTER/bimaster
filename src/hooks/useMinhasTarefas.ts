import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isToday, addDays, isBefore, startOfDay } from "date-fns";

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
  codigo: string | null;
  produto_id: string | null;
  created_at: string;
  updated_at: string;
  papel: "responsavel" | "colaborador";
}

export interface TarefaGroup {
  label: string;
  key: string;
  items: MinaTarefa[];
}

export function useMinhasTarefas() {
  const { user } = useAuth();

  return useQuery({
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
        codigo: t.codigo || null,
        produto_id: t.produto_id || null,
        created_at: t.created_at,
        updated_at: t.updated_at,
        papel: t.papel === "colaborador" ? "colaborador" : "responsavel",
      }));
    },
    enabled: !!user?.id,
  });
}

export function groupTarefas(tarefas: MinaTarefa[]): TarefaGroup[] {
  const now = startOfDay(new Date());
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

    if (!t.data_inicio_planejada || !t.data_prazo) {
      semData.push(t);
      continue;
    }

    const prazo = startOfDay(new Date(t.data_prazo));

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
