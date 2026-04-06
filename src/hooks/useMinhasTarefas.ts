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
  secao_id: string | null;
  secao_nome: string | null;
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
        .select("id, titulo, status, prioridade, data_prazo, data_conclusao, projeto_id, secao_id, estagio, criador_id, visibilidade, projetos:projeto_id(nome, cor), secao:secao_id(nome)")
        .eq("responsavel_id", user.id)
        .is("excluida_em", null)
        .order("data_prazo", { ascending: true, nullsFirst: false });

      if (error) throw error;

      const allTarefas = (data || []).map((t: any) => ({
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
        secao_id: t.secao_id as string | null,
        secao_nome: t.secao?.nome || null,
      }));

      // Fetch section visibility restrictions for this user
      const projetoIds = [...new Set(allTarefas.map(t => t.projeto_id))];
      if (projetoIds.length === 0) return allTarefas as MinaTarefa[];

      // Get user's membro records for all relevant projects
      const { data: membrosData } = await supabase
        .from("projeto_membros")
        .select("id, projeto_id")
        .eq("user_id", user.id)
        .in("projeto_id", projetoIds);

      if (!membrosData || membrosData.length === 0) return allTarefas as MinaTarefa[];

      const membroIds = membrosData.map(m => m.id);
      const { data: secAssignments } = await supabase
        .from("projeto_membro_secoes")
        .select("membro_id, secao_id")
        .in("membro_id", membroIds);

      // Build map: projeto_id → Set<secao_id>
      const membroToProjeto = new Map(membrosData.map(m => [m.id, m.projeto_id]));
      const allowedSecoesByProjeto = new Map<string, Set<string>>();

      for (const sa of (secAssignments || [])) {
        const projetoId = membroToProjeto.get(sa.membro_id);
        if (!projetoId) continue;
        if (!allowedSecoesByProjeto.has(projetoId)) {
          allowedSecoesByProjeto.set(projetoId, new Set());
        }
        allowedSecoesByProjeto.get(projetoId)!.add(sa.secao_id);
      }

      // Filter: 0 sections = full access, 1+ sections = restricted
      return allTarefas.filter(t => {
        const allowed = allowedSecoesByProjeto.get(t.projeto_id);
        if (!allowed || allowed.size === 0) return true; // no restriction
        if (!t.secao_id) return true; // tasks without section always visible
        return allowed.has(t.secao_id);
      }) as MinaTarefa[];
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
