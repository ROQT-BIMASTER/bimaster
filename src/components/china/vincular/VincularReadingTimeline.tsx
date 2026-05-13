import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Search, ExternalLink, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useChinaUnifiedTimeline } from "@/hooks/useChinaUnifiedTimeline";
import { kindConfig } from "@/lib/china/timeline/kinds";
import {
  eventTypeOf, TIMELINE_TYPE_LABELS, TIMELINE_ACTOR_LABELS,
  type TimelineEventType,
} from "@/lib/china/timeline/eventTypeGroups";
import { resolveTimelineNav, type VincularInternalTab } from "@/hooks/useVincularTimelineNav";
import type { ChinaTimelineEvent, ChinaTimelineActor } from "@/lib/china/timeline/types";

interface Props {
  submissaoId: string;
  /** Troca para outra aba do painel ao clicar num link interno. */
  onNavigateTab: (tab: VincularInternalTab) => void;
  /** Abre o preview de um documento da submissão. */
  onPreviewDocumento: (documentoId: string) => void;
}

const TYPE_OPTIONS: TimelineEventType[] = ["status", "documento", "chat", "outros"];
const ACTOR_OPTIONS: ChinaTimelineActor[] = ["china", "brasil", "sistema"];

const FILTERS_KEY = "china:vincular:timeline:filters";

interface PersistedFilters {
  types: TimelineEventType[];
  actors: ChinaTimelineActor[];
}

function loadFilters(): PersistedFilters {
  if (typeof window === "undefined") return { types: [...TYPE_OPTIONS], actors: [...ACTOR_OPTIONS] };
  try {
    const raw = window.localStorage.getItem(FILTERS_KEY);
    if (!raw) return { types: [...TYPE_OPTIONS], actors: [...ACTOR_OPTIONS] };
    const parsed = JSON.parse(raw);
    return {
      types: Array.isArray(parsed.types) ? parsed.types : [...TYPE_OPTIONS],
      actors: Array.isArray(parsed.actors) ? parsed.actors : [...ACTOR_OPTIONS],
    };
  } catch {
    return { types: [...TYPE_OPTIONS], actors: [...ACTOR_OPTIONS] };
  }
}

function saveFilters(f: PersistedFilters) {
  try { window.localStorage.setItem(FILTERS_KEY, JSON.stringify(f)); } catch { /* noop */ }
}

function bucketLabel(d: Date): string {
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function VincularReadingTimeline({ submissaoId, onNavigateTab, onPreviewDocumento }: Props) {
  const navigate = useNavigate();
  const { data: events = [], isLoading } = useChinaUnifiedTimeline({ submissaoId });
  const [query, setQuery] = useState("");
  const [filters, setFiltersState] = useState<PersistedFilters>(() => loadFilters());

  const setFilters = useCallback((next: PersistedFilters) => {
    setFiltersState(next);
    saveFilters(next);
  }, []);

  const toggleType = (t: TimelineEventType) => {
    const has = filters.types.includes(t);
    setFilters({ ...filters, types: has ? filters.types.filter((x) => x !== t) : [...filters.types, t] });
  };
  const toggleActor = (a: ChinaTimelineActor) => {
    const has = filters.actors.includes(a);
    setFilters({ ...filters, actors: has ? filters.actors.filter((x) => x !== a) : [...filters.actors, a] });
  };
  const resetFilters = () => setFilters({ types: [...TYPE_OPTIONS], actors: [...ACTOR_OPTIONS] });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (!filters.types.includes(eventTypeOf(e.kind))) return false;
      if (!filters.actors.includes(e.actor)) return false;
      if (!q) return true;
      const cfg = kindConfig(e.kind);
      const hay = `${e.title} ${e.descricao || ""} ${cfg.label}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, query, filters]);

  const buckets = useMemo(() => {
    const map = new Map<string, ChinaTimelineEvent[]>();
    for (const e of filtered) {
      const key = bucketLabel(new Date(e.timestamp));
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleNavigate = (event: ChinaTimelineEvent) => {
    const target = resolveTimelineNav(event);
    if (!target) return;
    if (target.documentoId) onPreviewDocumento(target.documentoId);
    if (target.tab) onNavigateTab(target.tab);
    if (target.href) navigate(target.href);
  };

  const filtersTouched =
    filters.types.length !== TYPE_OPTIONS.length || filters.actors.length !== ACTOR_OPTIONS.length;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-4 pt-3 pb-2 space-y-2 border-b border-border/60 bg-card/30">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar evento..."
            className="h-7 pl-7 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Filter className="h-3 w-3" /> Tipo
          </span>
          {TYPE_OPTIONS.map((t) => {
            const active = filters.types.includes(t);
            return (
              <Badge
                key={t}
                variant={active ? "default" : "outline"}
                className="cursor-pointer text-[10px] h-5"
                onClick={() => toggleType(t)}
                aria-pressed={active}
              >
                {TIMELINE_TYPE_LABELS[t]}
              </Badge>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Ator</span>
          {ACTOR_OPTIONS.map((a) => {
            const active = filters.actors.includes(a);
            return (
              <Badge
                key={a}
                variant={active ? "default" : "outline"}
                className="cursor-pointer text-[10px] h-5"
                onClick={() => toggleActor(a)}
                aria-pressed={active}
              >
                {TIMELINE_ACTOR_LABELS[a]}
              </Badge>
            );
          })}
          {filtersTouched && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-muted-foreground ml-auto"
              onClick={resetFilters}
            >
              <X className="h-3 w-3 mr-0.5" /> Limpar
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : buckets.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-12">
            Nenhum evento {events.length > 0 ? "para os filtros atuais" : "registrado"}.
          </p>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="space-y-4">
              {buckets.map(([day, items]) => (
                <div key={day}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {day}
                  </div>
                  <ol className="relative border-l border-border pl-4 space-y-2.5">
                    {items.map((e) => {
                      const cfg = kindConfig(e.kind);
                      const Icon = cfg.icon;
                      const nav = resolveTimelineNav(e);
                      return (
                        <li key={e.id} className="relative">
                          <span
                            className={cn(
                              "absolute -left-[22px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center",
                              cfg.tint,
                            )}
                          >
                            <Icon className="h-2.5 w-2.5" />
                          </span>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-medium text-foreground">{e.title}</span>
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                  {cfg.label}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[9px] px-1 py-0 h-4",
                                    e.actor === "china" && "border-primary/30 text-primary",
                                    e.actor === "brasil" && "border-emerald-500/30 text-emerald-500",
                                    e.actor === "sistema" && "border-muted-foreground/30 text-muted-foreground",
                                  )}
                                >
                                  {TIMELINE_ACTOR_LABELS[e.actor]}
                                </Badge>
                              </div>
                              {e.descricao && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 break-words">
                                  {e.descricao}
                                </p>
                              )}
                              <span
                                className="text-[10px] text-muted-foreground/70"
                                title={format(new Date(e.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              >
                                {formatDistanceToNow(new Date(e.timestamp), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {format(new Date(e.timestamp), "HH:mm")}
                              </span>
                              {nav && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleNavigate(e)}
                                      aria-label={nav.label}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="text-[10px]">
                                    {nav.label}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ))}
            </div>
          </TooltipProvider>
        )}
      </ScrollArea>
    </div>
  );
}
