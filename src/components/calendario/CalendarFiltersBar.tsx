import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./types";
import type { EquipeProjeto } from "@/hooks/useEquipesProjetos";

export interface CalendarFiltersState {
  equipeIds: string[];
  responsavelIds: string[];
  projetoIds: string[];
}

export const EMPTY_CALENDAR_FILTERS: CalendarFiltersState = {
  equipeIds: [],
  responsavelIds: [],
  projetoIds: [],
};

export function countCalendarFilters(f: CalendarFiltersState): number {
  return f.equipeIds.length + f.responsavelIds.length + f.projetoIds.length;
}

/**
 * Aplica os filtros de equipe / responsável / projeto sobre os eventos.
 * Equipe é resolvida pelos membros: o evento entra se o responsável pertence
 * a pelo menos uma das equipes selecionadas.
 */
export function applyCalendarFilters(
  events: CalendarEvent[],
  filters: CalendarFiltersState,
  equipes: EquipeProjeto[],
): CalendarEvent[] {
  const membrosEquipes = new Set<string>();
  if (filters.equipeIds.length) {
    equipes
      .filter((e) => filters.equipeIds.includes(e.id))
      .forEach((e) => e.membros.forEach((m) => membrosEquipes.add(m)));
  }

  return events.filter((ev) => {
    if (filters.projetoIds.length && !(ev.projeto && filters.projetoIds.includes(ev.projeto.id))) return false;
    if (filters.responsavelIds.length && !(ev.responsavel_id && filters.responsavelIds.includes(ev.responsavel_id))) return false;
    if (membrosEquipes.size && !(ev.responsavel_id && membrosEquipes.has(ev.responsavel_id))) return false;
    return true;
  });
}

interface Option {
  id: string;
  nome: string;
}

interface Props {
  filters: CalendarFiltersState;
  onChange: (next: CalendarFiltersState) => void;
  equipes: EquipeProjeto[];
  responsaveis: Option[];
  /** Omitido em visões de projeto único. */
  projetos?: Option[];
  darkBg?: boolean;
}

export function CalendarFiltersBar({ filters, onChange, equipes, responsaveis, projetos, darkBg = false }: Props) {
  const total = countCalendarFilters(filters);

  const toggle = (key: keyof CalendarFiltersState, id: string) => {
    const cur = filters[key];
    onChange({ ...filters, [key]: cur.includes(id) ? cur.filter((v) => v !== id) : [...cur, id] });
  };

  const groups = useMemo(() => {
    const g: Array<{ key: keyof CalendarFiltersState; label: string; options: Option[] }> = [
      { key: "equipeIds", label: "Equipes", options: equipes.map((e) => ({ id: e.id, nome: e.nome })) },
      { key: "responsavelIds", label: "Responsáveis", options: responsaveis },
    ];
    if (projetos?.length) g.push({ key: "projetoIds", label: "Projetos", options: projetos });
    return g.filter((x) => x.options.length > 0);
  }, [equipes, responsaveis, projetos]);

  if (!groups.length) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 text-xs gap-1.5", darkBg && "bg-white/10 border-white/20 text-white hover:bg-white/20")}
        >
          <Filter className="h-3.5 w-3.5" />
          Filtros
          {total > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{total}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs font-semibold">Filtrar calendário</span>
          {total > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] gap-1"
              onClick={() => onChange(EMPTY_CALENDAR_FILTERS)}
            >
              <X className="h-3 w-3" /> Limpar
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          <div className="p-3 space-y-4">
            {groups.map((g) => (
              <div key={g.key} className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                {g.options.map((o) => {
                  const checked = filters[g.key].includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className="flex items-center gap-2 text-xs cursor-pointer rounded px-1 py-0.5 hover:bg-muted"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(g.key, o.id)} />
                      <span className="truncate">{o.nome}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
