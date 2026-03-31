import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isToday, isPast, isFuture, addDays, isBefore, isAfter, startOfDay } from "date-fns";

export interface MinaTarefa {
  id: string;
  titulo: string;
  status: string;
  prioridade: string | null;
  data_prazo: string | null;
  data_conclusao: string | null;
  projeto_id: string;
  projeto_nome: string;
  projeto_cor: string;
  estagio: string | null;
  criador_id: string | null;
  visibilidade: string | null;
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

      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, status, prioridade, data_prazo, data_conclusao, projeto_id, estagio, criador_id, visibilidade, projetos:projeto_id(nome, cor)")
        .eq("responsavel_id", user.id)
        .is("excluida_em", null)
        .order("data_prazo", { ascending: true, nullsFirst: false });

      if (error) throw error;

      return (data || []).map((t: any) => ({
        id: t.id,
        titulo: t.titulo,
        status: t.status,
        prioridade: t.prioridade,
        data_prazo: t.data_prazo,
        data_conclusao: t.data_conclusao,
        projeto_id: t.projeto_id,
        projeto_nome: t.projetos?.nome || "Sem projeto",
        projeto_cor: t.projetos?.cor || "#6366f1",
        estagio: t.estagio,
        criador_id: t.criador_id,
        visibilidade: t.visibilidade,
      })) as MinaTarefa[];
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

    if (!t.data_prazo) {
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
    { label: "Sem data", key: "sem_data", items: semData },
    { label: "Concluídas recentemente", key: "concluidas", items: concluidas.slice(0, 5) },
  ].filter(g => g.items.length > 0);
}
