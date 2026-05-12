import { useEffect, useMemo, useState } from "react";
import { useChinaUnifiedTimeline } from "@/hooks/useChinaUnifiedTimeline";
import type { ChinaTimelineEvent, ChinaTimelineScope } from "@/lib/china/timeline/types";
import { kindConfig } from "@/lib/china/timeline/kinds";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, CalendarRange, X } from "lucide-react";
import { format, isToday, isYesterday, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TimelineEventDetailDialog } from "./TimelineEventDetailDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

interface Props {
  scope: ChinaTimelineScope;
  /** Notifica o pai com a lista filtrada para que ele possa exportar PDF. */
  onFilteredChange?: (events: ChinaTimelineEvent[]) => void;
}

const GROUP_LABELS: Record<string, string> = {
  submissao: "Submissão",
  documento: "Documentos",
  governanca: "Governança",
  oc: "Ordem de Compra",
  producao: "Produção",
  embarque: "Embarque",
  recebimento: "Recebimento",
  nc: "Não Conformidade",
  chat: "Chat",
};

function bucketLabel(d: Date): string {
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function ChinaUnifiedTimelineEventsBody({ scope, onFilteredChange }: Props) {
  const { data: events = [], isLoading } = useChinaUnifiedTimeline(scope);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedEvent, setSelectedEvent] = useState<ChinaTimelineEvent | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromDate = dateRange?.from ? startOfDay(dateRange.from) : null;
    const toDate = dateRange?.to ? endOfDay(dateRange.to) : (dateRange?.from ? endOfDay(dateRange.from) : null);
    return events.filter((e) => {
      const cfg = kindConfig(e.kind);
      if (groupFilter && cfg.group !== groupFilter) return false;
      if (fromDate || toDate) {
        const t = parseISO(e.timestamp);
        if (fromDate && isBefore(t, fromDate)) return false;
        if (toDate && isAfter(t, toDate)) return false;
      }
      if (!q) return true;
      const hay = `${e.title} ${e.descricao || ""} ${cfg.label}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, query, groupFilter, dateRange]);

  // Notifica o pai sempre que filtered mudar.
  useEffect(() => { onFilteredChange?.(filtered); }, [filtered, onFilteredChange]);

  const buckets = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const key = bucketLabel(new Date(e.timestamp));
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(kindConfig(e.kind).group);
    return Array.from(set);
  }, [events]);

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, "dd/MM")} → ${format(dateRange.to, "dd/MM")}`
      : format(dateRange.from, "dd/MM/yyyy")
    : "Período";

  const hasActiveFilters = !!query || !!groupFilter || !!dateRange?.from;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pb-2 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar evento..."
              className="h-8 pl-7 text-xs"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-8 gap-1.5 text-xs", dateRange?.from && "border-primary text-primary")}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                {dateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
              {dateRange?.from && (
                <div className="border-t p-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setDateRange(undefined)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpar período
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
        {groups.length > 1 && (
          <div className="flex flex-wrap gap-1">
            <Badge
              variant={groupFilter === null ? "default" : "outline"}
              className="cursor-pointer text-[10px]"
              onClick={() => setGroupFilter(null)}
            >
              Todos
            </Badge>
            {groups.map((g) => (
              <Badge
                key={g}
                variant={groupFilter === g ? "default" : "outline"}
                className="cursor-pointer text-[10px]"
                onClick={() => setGroupFilter(groupFilter === g ? null : g)}
              >
                {GROUP_LABELS[g] || g}
              </Badge>
            ))}
          </div>
        )}
        {hasActiveFilters && (
          <p className="text-[10px] text-muted-foreground">
            {filtered.length} de {events.length} eventos
          </p>
        )}
      </div>

      <ScrollArea className="flex-1 px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : buckets.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-12">
            Nenhum evento encontrado.
          </p>
        ) : (
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
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(e)}
                          className="w-full text-left rounded-md -mx-1.5 px-1.5 py-1 hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-medium text-foreground">
                                  {e.title}
                                </span>
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                  {cfg.label}
                                </Badge>
                              </div>
                              {e.descricao && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 break-words line-clamp-2">
                                  {e.descricao}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {format(new Date(e.timestamp), "HH:mm")}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <TimelineEventDetailDialog
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(o) => { if (!o) setSelectedEvent(null); }}
      />
    </div>
  );
}
