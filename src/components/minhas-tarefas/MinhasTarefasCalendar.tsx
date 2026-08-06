import { useMemo, useState } from "react";
import { UnifiedCalendar } from "@/components/calendario/UnifiedCalendar";
import { minaTarefaToEvent } from "@/components/calendario/types";
import { useEquipesProjetos } from "@/hooks/useEquipesProjetos";
import {
  CalendarFiltersBar, EMPTY_CALENDAR_FILTERS, applyCalendarFilters,
  type CalendarFiltersState,
} from "@/components/calendario/CalendarFiltersBar";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface Props {
  tarefas: MinaTarefa[];
  onSelect: (t: MinaTarefa) => void;
  onComplete?: (t: MinaTarefa) => void;
}

/**
 * Calendário da Central de Trabalho.
 * Compartilha o mesmo grid e visual com `ProjetoCalendarioView` via
 * `UnifiedCalendar`. Como agrega tarefas de múltiplos projetos, oferece
 * filtros por equipe, responsável e projeto.
 */
export function MinhasTarefasCalendar({ tarefas, onSelect }: Props) {
  const [filters, setFilters] = useState<CalendarFiltersState>(EMPTY_CALENDAR_FILTERS);
  const { data: equipes = [] } = useEquipesProjetos();

  const allEvents = useMemo(() => tarefas.map(minaTarefaToEvent), [tarefas]);
  const events = useMemo(
    () => applyCalendarFilters(allEvents, filters, equipes),
    [allEvents, filters, equipes],
  );

  const responsaveis = useMemo(() => {
    const map = new Map<string, string>();
    tarefas.forEach((t) => {
      if (t.responsavel_id && t.responsavel_nome) map.set(t.responsavel_id, t.responsavel_nome);
    });
    return Array.from(map, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefas]);

  const projetos = useMemo(() => {
    const map = new Map<string, string>();
    tarefas.forEach((t) => { if (t.projeto_id) map.set(t.projeto_id, t.projeto_nome); });
    return Array.from(map, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefas]);

  const byId = useMemo(() => {
    const m = new Map<string, MinaTarefa>();
    tarefas.forEach((t) => m.set(t.id, t));
    return m;
  }, [tarefas]);

  return (
    <UnifiedCalendar
      events={events}
      onSelectEvent={(ev) => {
        const t = byId.get(ev.id);
        if (t) onSelect(t);
      }}
      colorStrategy="estagio"
      rightToolbarExtra={
        <CalendarFiltersBar
          filters={filters}
          onChange={setFilters}
          equipes={equipes}
          responsaveis={responsaveis}
          projetos={projetos}
        />
      }
    />
  );
}
