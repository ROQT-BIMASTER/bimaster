import { ProjetoFilters, ProjetoSort } from "@/components/projetos/ProjetoFilterSort";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { parseLocalDate } from "@/utils/dateUtils";
import { isPast, isToday } from "date-fns";

const PRIORIDADE_ORDER: Record<string, number> = {
  urgente: 0, alta: 1, media: 2, baixa: 3,
};

export function applyProjetoFilters(
  tarefas: ProjetoTarefa[],
  filters: ProjetoFilters
): ProjetoTarefa[] {
  return tarefas.filter((t) => {
    if (filters.status.length > 0 && !filters.status.includes(t.status)) return false;
    if (filters.prioridade.length > 0 && !filters.prioridade.includes(t.prioridade || "")) return false;
    if (filters.estagio.length > 0 && !filters.estagio.includes(t.estagio || "")) return false;
    if (filters.tipo.length > 0) {
      const tipo = t.is_retrabalho ? "retrabalho" : "padrao";
      if (!filters.tipo.includes(tipo)) return false;
    }
    if (filters.responsavelId && t.responsavel_id !== filters.responsavelId) return false;
    if (filters.atrasadas) {
      if (!t.data_prazo) return false;
      const d = parseLocalDate(t.data_prazo);
      if (!d || !(isPast(d) && !isToday(d) && t.status !== "concluida")) return false;
    }
    return true;
  });
}

export function applyProjetoSort(
  tarefas: ProjetoTarefa[],
  sort: ProjetoSort
): ProjetoTarefa[] {
  const sorted = [...tarefas];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sort.field) {
      case "titulo":
        cmp = (a.titulo || "").localeCompare(b.titulo || "");
        break;
      case "data_prazo":
        cmp = (a.data_prazo || "9999").localeCompare(b.data_prazo || "9999");
        break;
      case "prioridade":
        cmp = (PRIORIDADE_ORDER[a.prioridade || "media"] ?? 2) - (PRIORIDADE_ORDER[b.prioridade || "media"] ?? 2);
        break;
      case "created_at":
        cmp = (a.created_at || "").localeCompare(b.created_at || "");
        break;
      case "status":
        cmp = (a.status || "").localeCompare(b.status || "");
        break;
    }
    return sort.direction === "desc" ? -cmp : cmp;
  });
  return sorted;
}

export function hasActiveFilters(filters: ProjetoFilters): boolean {
  return (
    filters.status.length > 0 ||
    filters.prioridade.length > 0 ||
    filters.estagio.length > 0 ||
    filters.tipo.length > 0 ||
    !!filters.responsavelId ||
    filters.atrasadas
  );
}
