import { useMemo } from "react";
import { UnifiedCalendar } from "@/components/calendario/UnifiedCalendar";
import { minaTarefaToEvent } from "@/components/calendario/types";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface Props {
  tarefas: MinaTarefa[];
  onSelect: (t: MinaTarefa) => void;
  onComplete?: (t: MinaTarefa) => void;
}

/**
 * Calendário da Central de Trabalho.
 * Compartilha o mesmo grid e visual com `ProjetoCalendarioView` via
 * `UnifiedCalendar`. Como agrega tarefas de múltiplos projetos, usa
 * `colorStrategy="projeto"` para diferenciar visualmente cada projeto pela
 * sua cor própria, mantendo avatar + tooltip do responsável.
 */
export function MinhasTarefasCalendar({ tarefas, onSelect }: Props) {
  const events = useMemo(() => tarefas.map(minaTarefaToEvent), [tarefas]);
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
    />
  );
}
