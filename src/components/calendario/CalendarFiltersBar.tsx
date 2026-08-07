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
  /** Status da tarefa/evento (pendente, em_andamento, concluida, bloqueada, evento). */
  status: string[];
  /** Categoria de eventos avulsos (reuniao, viagem...). */
  categorias: string[];
  /** Marcadores livres do evento. */
  tags: string[];
}

export const EMPTY_CALENDAR_FILTERS: CalendarFiltersState = {
  equipeIds: [],
  responsavelIds: [],
  projetoIds: [],
  status: [],
  categorias: [],
  tags: [],
};

export const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
  evento: "Evento avulso",
};

export const CATEGORIA_LABELS: Record<string, string> = {
  geral: "Geral",
  reuniao: "Reunião",
  viagem: "Viagem",
  treinamento: "Treinamento",
  feriado: "Feriado",
  prazo: "Prazo",
};

/** Normaliza filtros vindos de preferências salvas (podem estar incompletos). */
export function normalizeCalendarFilters(raw: unknown): CalendarFiltersState {
  const o = (raw ?? {}) as Partial<Record<keyof CalendarFiltersState, unknown>>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    equipeIds: arr(o.equipeIds),
    responsavelIds: arr(o.responsavelIds),
    projetoIds: arr(o.projetoIds),
    status: arr(o.status),
    categorias: arr(o.categorias),
    tags: arr(o.tags),
  };
}

export function countCalendarFilters(f: CalendarFiltersState): number {
  return (
    f.equipeIds.length + f.responsavelIds.length + f.projetoIds.length +
    f.status.length + f.categorias.length + f.tags.length
  );
}

/**
 * Aplica os filtros de equipe / responsável / projeto / status / categoria / tags.
 * Equipe é resolvida pelos membros: o evento entra se o responsável pertence
 * a pelo menos uma das equipes selecionadas.
 */
export function applyCalendarFilters(
  events: CalendarEvent[],
  filters: CalendarFiltersState,
  equipes: EquipeProjeto[],
): CalendarEvent[] {
  const f = { ...EMPTY_CALENDAR_FILTERS, ...filters };
  const membrosEquipes = new Set<string>();
  if (f.equipeIds.length) {
    equipes
      .filter((e) => f.equipeIds.includes(e.id))
      .forEach((e) => e.membros.forEach((m) => membrosEquipes.add(m)));
  }

  return events.filter((ev) => {
    if (f.projetoIds.length && !(ev.projeto && f.projetoIds.includes(ev.projeto.id))) return false;
    if (f.responsavelIds.length && !(ev.responsavel_id && f.responsavelIds.includes(ev.responsavel_id))) return false;
    if (membrosEquipes.size && !(ev.responsavel_id && membrosEquipes.has(ev.responsavel_id))) return false;
    if (f.status.length && !f.status.includes(ev.status)) return false;
    if (f.categorias.length && !(ev.categoria && f.categorias.includes(ev.categoria))) return false;
    if (f.tags.length && !(ev.tags || []).some((t) => f.tags.includes(t))) return false;
    return true;
  });
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Busca textual por título, descrição e local. Deve ser aplicada depois das
 * regras de visibilidade — nunca revela eventos fora do escopo do usuário.
 */
export function applyCalendarBusca(events: CalendarEvent[], termo: string): CalendarEvent[] {
  const q = semAcento(termo.trim());
  if (!q) return events;
  return events.filter((ev) =>
    [ev.titulo, ev.descricao, ev.local, ev.projeto?.nome, ...(ev.tags ?? [])]
      .filter(Boolean)
      .some((campo) => semAcento(String(campo)).includes(q)),
  );
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
  /** Status disponíveis nos eventos carregados. */
  statusDisponiveis?: string[];
  /** Categorias de eventos avulsos disponíveis. */
  categorias?: string[];
  /** Marcadores disponíveis. */
  tags?: string[];
  darkBg?: boolean;
  /** Slot extra no rodapé (ex.: salvar preferências). */
  footer?: React.ReactNode;
}

export function CalendarFiltersBar({
  filters, onChange, equipes, responsaveis, projetos,
  statusDisponiveis, categorias, tags, darkBg = false, footer,
}: Props) {
  const f = { ...EMPTY_CALENDAR_FILTERS, ...filters };
  const total = countCalendarFilters(f);

  const toggle = (key: keyof CalendarFiltersState, id: string) => {
    const cur = f[key];
    onChange({ ...f, [key]: cur.includes(id) ? cur.filter((v) => v !== id) : [...cur, id] });
  };

  const groups = useMemo(() => {
    const g: Array<{ key: keyof CalendarFiltersState; label: string; options: Option[] }> = [
      { key: "equipeIds", label: "Equipes", options: equipes.map((e) => ({ id: e.id, nome: e.nome })) },
      { key: "responsavelIds", label: "Responsáveis", options: responsaveis },
    ];
    if (projetos?.length) g.push({ key: "projetoIds", label: "Projetos", options: projetos });
    if (statusDisponiveis?.length) {
      g.push({
        key: "status",
        label: "Status",
        options: statusDisponiveis.map((s) => ({ id: s, nome: STATUS_LABELS[s] ?? s })),
      });
    }
    if (categorias?.length) {
      g.push({
        key: "categorias",
        label: "Categorias",
        options: categorias.map((c) => ({ id: c, nome: CATEGORIA_LABELS[c] ?? c })),
      });
    }
    if (tags?.length) {
      g.push({ key: "tags", label: "Marcadores", options: tags.map((t) => ({ id: t, nome: t })) });
    }
    return g.filter((x) => x.options.length > 0);
  }, [equipes, responsaveis, projetos, statusDisponiveis, categorias, tags]);

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
                  const checked = f[g.key].includes(o.id);
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
        {footer && <div className="border-t p-2">{footer}</div>}
      </PopoverContent>
    </Popover>
  );
}
