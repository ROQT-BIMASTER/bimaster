import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks,
  format, isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getDateKey, parseLocalDate, getToday } from "@/utils/dateUtils";
import { packLanes, splitEventByWeekRow } from "@/lib/calendario/lanePacking";
import { EventChip } from "./EventChip";
import { EventBar, EVENT_LANE_HEIGHT, EVENT_LANE_GAP } from "./EventBar";
import type { CalendarEvent, ColorStrategy } from "./types";
import { ESTAGIO_LABELS, ESTAGIO_PILL_COLORS } from "@/lib/projetoConstants";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
type ViewMode = "month" | "week" | "agenda";

interface Props {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  /** Cor da borda/dot: "estagio" para Projetos, "projeto" para Central. */
  colorStrategy?: ColorStrategy;
  compact?: boolean;
  darkBg?: boolean;
  /** Slot extra à esquerda do toolbar (ex.: botão de Análise). */
  leftToolbarExtra?: ReactNode;
  /** Slot à direita do toolbar (ex.: filtros adicionais). */
  rightToolbarExtra?: ReactNode;
  /** Mostra a legenda de estágios (default: true se colorStrategy === "estagio"). */
  showEstagioLegend?: boolean;
  /** Banner opcional acima do toolbar (ex.: aviso de prazos). */
  banner?: ReactNode;
  /** Chamado quando o período visível muda (para análises externas). */
  onPeriodChange?: (info: { inicio: Date; fim: Date; viewMode: ViewMode; label: string }) => void;
  /** Habilita criação de evento no dia clicado (recebe a data em formato Y-M-D). */
  onCreateAt?: (dateKey: string) => void;
  /** Habilita arraste para reagendar. Recebe o evento e a nova data (Y-M-D). */
  onMoveEvent?: (event: CalendarEvent, novaDataKey: string) => void;
  /** Define quais eventos podem ser arrastados (default: todos, quando onMoveEvent existe). */
  canDragEvent?: (event: CalendarEvent) => boolean;
}

export function UnifiedCalendar({
  events,
  onSelectEvent,
  colorStrategy = "estagio",
  compact = false,
  darkBg = false,
  leftToolbarExtra,
  rightToolbarExtra,
  showEstagioLegend,
  banner,
  onPeriodChange,
  onCreateAt,
  onMoveEvent,
  canDragEvent,
}: Props) {
  const [currentDate, setCurrentDate] = useState(() => getToday());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [arrastando, setArrastando] = useState<CalendarEvent | null>(null);
  const [alvoDrop, setAlvoDrop] = useState<string | null>(null);

  const podeArrastar = (ev: CalendarEvent) =>
    !!onMoveEvent && (canDragEvent ? canDragEvent(ev) : true);

  const dragHandlers = (ev: CalendarEvent) =>
    podeArrastar(ev)
      ? {
          draggable: true,
          onDragStart: (e: React.DragEvent<HTMLButtonElement>) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", ev.id);
            setArrastando(ev);
          },
          onDragEnd: () => { setArrastando(null); setAlvoDrop(null); },
        }
      : {};

  const soltarNoDia = (dateKey: string) => {
    const ev = arrastando;
    setArrastando(null);
    setAlvoDrop(null);
    if (!ev || !onMoveEvent) return;
    if (ev.data_inicio === dateKey) return;
    onMoveEvent(ev, dateKey);
  };


  // Notifica mudanças de período (mês/semana visível) para wrappers (ex.: painel de Análise).
  useEffect(() => {
    if (!onPeriodChange) return;
    const inicio = viewMode === "week" ? startOfWeek(currentDate, { weekStartsOn: 1 }) : startOfMonth(currentDate);
    const fim = viewMode === "week" ? endOfWeek(currentDate, { weekStartsOn: 1 }) : endOfMonth(currentDate);
    const label = viewMode !== "week"
      ? format(currentDate, "'Mês de' MMMM yyyy", { locale: ptBR })
      : `Semana de ${format(inicio, "dd MMM", { locale: ptBR })} – ${format(fim, "dd MMM", { locale: ptBR })}`;
    onPeriodChange({ inicio, fim, viewMode, label });
  }, [currentDate, viewMode, onPeriodChange]);

  // Single-day vs multi-day
  const singleDayByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const start = ev.data_inicio;
      const end = ev.data_prazo;
      if (!end) continue;
      if (start && end && start !== end) continue; // multi-dia
      const key = getDateKey(end);
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  const multiDayEvents = useMemo(() =>
    events
      .filter((ev) => ev.data_inicio && ev.data_prazo && ev.data_inicio !== ev.data_prazo)
      .map((ev) => ({
        event: ev,
        start: parseLocalDate(ev.data_inicio!)!,
        end: parseLocalDate(ev.data_prazo!)!,
      }))
      .filter((x) => x.start && x.end),
  [events]);

  const days = useMemo(() => {
    if (viewMode !== "week") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: gridStart, end: gridEnd });
    }
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate, viewMode]);

  const weekRows = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [days]);

  const multiDayByRow = useMemo(() => {
    const rows: Array<Array<{ event: CalendarEvent; startCol: number; endCol: number; lane: number; continuesLeft: boolean; continuesRight: boolean }>> = weekRows.map(() => []);
    multiDayEvents.forEach(({ event, start, end }) => {
      const segments = splitEventByWeekRow(start, end, weekRows);
      segments.forEach((seg) => {
        const continuesLeft = weekRows[seg.rowIndex][seg.startCol].getTime() > start.getTime();
        const continuesRight = weekRows[seg.rowIndex][seg.endCol].getTime() < end.getTime();
        rows[seg.rowIndex].push({ event, startCol: seg.startCol, endCol: seg.endCol, lane: 0, continuesLeft, continuesRight });
      });
    });
    return rows.map((rowEvents) => {
      const ids = rowEvents.map((e, i) => ({ id: `${e.event.id}-${i}`, startCol: e.startCol, endCol: e.endCol }));
      const packed = packLanes(ids);
      return rowEvents.map((e, i) => ({ ...e, lane: packed.find((p) => p.event.id === `${e.event.id}-${i}`)?.lane ?? 0 }));
    });
  }, [multiDayEvents, weekRows]);

  const maxLanesByRow = useMemo(
    () => multiDayByRow.map((row) => row.reduce((m, e) => Math.max(m, e.lane + 1), 0)),
    [multiDayByRow],
  );

  // Chave de "hoje" em America/Sao_Paulo — usada para destacar a célula correta
  // mesmo quando o navegador está em outro fuso.
  const todayKey = useMemo(() => getDateKey(getToday()), []);

  const navigate = (dir: "prev" | "next") => {
    if (viewMode !== "week") {
      setCurrentDate(dir === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(dir === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const txt = darkBg ? "text-white" : "text-foreground";
  const txtMuted = darkBg ? "text-white/60" : "text-muted-foreground";
  const border = darkBg ? "border-white/10" : "border-border/40";
  const cellBg = darkBg ? "bg-white/[0.02]" : "bg-background";
  const cellBgWeekend = darkBg ? "bg-white/[0.01]" : "bg-muted/20";
  const cellBgToday = darkBg
    ? "bg-gradient-to-br from-primary/15 via-primary/5 to-transparent"
    : "bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent";
  const cellBgOutside = darkBg ? "bg-transparent" : "bg-muted/30";
  const btnGhost = darkBg ? "text-white hover:bg-white/10" : "";

  const maxVisible = compact ? (viewMode === "month" ? 2 : 18) : (viewMode === "month" ? 3 : 20);
  const cellMinH = compact ? (viewMode === "month" ? 84 : 180) : (viewMode === "month" ? 124 : 220);

  const showLegend = showEstagioLegend ?? (colorStrategy === "estagio");

  return (
    <div className="space-y-4">
      {banner}
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", btnGhost)} onClick={() => navigate("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn("text-lg font-semibold capitalize min-w-[180px] text-center cursor-pointer hover:opacity-80 transition-opacity", txt)}>
                {viewMode !== "week"
                  ? format(currentDate, "MMMM yyyy", { locale: ptBR })
                  : `Semana de ${format(days[0], "dd MMM", { locale: ptBR })} – ${format(days[6], "dd MMM", { locale: ptBR })}`}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <CalendarPicker
                mode="single"
                selected={currentDate}
                onSelect={(d) => d && setCurrentDate(d)}
                locale={ptBR}
                captionLayout="dropdown-buttons"
                fromYear={2020}
                toYear={2030}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", btnGhost)} onClick={() => navigate("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 text-xs ml-2", darkBg && "bg-white/10 border-white/20 text-white hover:bg-white/20")}
            onClick={() => setCurrentDate(getToday())}
          >
            Hoje
          </Button>
          {leftToolbarExtra}
        </div>

        <div className="flex items-center gap-2">
          <div className={cn("flex rounded-md border overflow-hidden", border)}>
            <button
              onClick={() => setViewMode("month")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "month"
                  ? (darkBg ? "bg-white/20 text-white" : "bg-primary text-primary-foreground")
                  : (darkBg ? "text-white/60 hover:bg-white/10" : "text-muted-foreground hover:bg-muted"),
              )}
            >
              Mês
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "week"
                  ? (darkBg ? "bg-white/20 text-white" : "bg-primary text-primary-foreground")
                  : (darkBg ? "text-white/60 hover:bg-white/10" : "text-muted-foreground hover:bg-muted"),
              )}
            >
              Semana
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                viewMode === "agenda"
                  ? (darkBg ? "bg-white/20 text-white" : "bg-primary text-primary-foreground")
                  : (darkBg ? "text-white/60 hover:bg-white/10" : "text-muted-foreground hover:bg-muted"),
              )}
            >
              Agenda
            </button>
          </div>
          {rightToolbarExtra}
        </div>
      </div>

      {/* Agenda */}
      {viewMode === "agenda" && (
        <AgendaList
          events={events}
          days={days}
          darkBg={darkBg}
          colorStrategy={colorStrategy}
          onSelectEvent={onSelectEvent}
        />
      )}

      {/* Grid */}
      {viewMode !== "agenda" && (
      <div className={cn("border rounded-lg overflow-hidden", border)}>
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className={cn(
                "text-center text-xs font-semibold py-2 border-b tracking-wide uppercase",
                border,
                darkBg ? "bg-white/5 text-white/70" : "bg-muted/40 text-muted-foreground",
              )}
            >
              {d}
            </div>
          ))}
        </div>
        {weekRows.map((row, rowIdx) => {
          const lanes = maxLanesByRow[rowIdx] ?? 0;
          const barsHeight = lanes * (EVENT_LANE_HEIGHT + EVENT_LANE_GAP);
          return (
            <div key={rowIdx} className="relative grid grid-cols-7">
              {row.map((day, ci) => {
                const key = getDateKey(day);
                const dayEvents = (key && singleDayByDate[key]) || [];
                const isCurrentMonth = isSameMonth(day, currentDate);
                const today = key === todayKey;
                const isWeekend = ci >= 5;
                return (
                  <div
                    key={ci}
                    style={{ minHeight: cellMinH }}
                    onDragOver={(e) => {
                      if (!arrastando || !key) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (alvoDrop !== key) setAlvoDrop(key);
                    }}
                    onDragLeave={() => { if (alvoDrop === key) setAlvoDrop(null); }}
                    onDrop={(e) => { if (!key) return; e.preventDefault(); soltarNoDia(key); }}
                    className={cn(
                      "border-b border-r p-1.5 transition-colors relative group/day",
                      border,
                      today
                        ? cellBgToday
                        : !isCurrentMonth
                          ? cellBgOutside
                          : isWeekend
                            ? cellBgWeekend
                            : cellBg,
                      arrastando && alvoDrop === key && "ring-2 ring-inset ring-primary/60 bg-primary/5",
                    )}
                  >
                    <div className="flex items-start justify-between mb-1">
                      {onCreateAt && key ? (
                        <button
                          type="button"
                          aria-label={`Novo evento em ${format(day, "dd/MM/yyyy")}`}
                          onClick={(e) => { e.stopPropagation(); onCreateAt(key); }}
                          className={cn(
                            "opacity-0 hover:opacity-100 focus-visible:opacity-100 group-hover/day:opacity-100 transition-opacity",
                            "inline-flex items-center justify-center w-5 h-5 rounded-md",
                            darkBg ? "text-white/70 hover:bg-white/15" : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      ) : <span />}
                      <span
                        className={cn(
                          "inline-flex items-center justify-center text-[11px] font-semibold w-6 h-6 rounded-full transition-all",
                          today
                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                            : isCurrentMonth ? txt : txtMuted,
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                    {barsHeight > 0 && <div style={{ height: barsHeight + 2 }} />}
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, maxVisible).map((ev) => (
                        <EventChip
                          key={ev.id}
                          event={ev}
                          darkBg={darkBg}
                          compact={compact}
                          colorStrategy={colorStrategy}
                          onClick={() => onSelectEvent(ev)}
                          {...dragHandlers(ev)}
                        />
                      ))}
                      {dayEvents.length > maxVisible && (
                        <OverflowPopover
                          events={dayEvents.slice(maxVisible)}
                          count={dayEvents.length - maxVisible}
                          darkBg={darkBg}
                          colorStrategy={colorStrategy}
                          onSelectEvent={onSelectEvent}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Multi-day bars */}
              {multiDayByRow[rowIdx]?.length > 0 && (
                <div className="absolute left-0 right-0 pointer-events-none" style={{ top: 30 }}>
                  <div className="relative" style={{ height: barsHeight }}>
                    {multiDayByRow[rowIdx].map((b, i) => (
                      <div key={`${b.event.id}-${i}`} className="pointer-events-auto">
                        <EventBar
                          event={b.event}
                          startCol={b.startCol}
                          endCol={b.endCol}
                          lane={b.lane}
                          continuesLeft={b.continuesLeft}
                          continuesRight={b.continuesRight}
                          darkBg={darkBg}
                          colorStrategy={colorStrategy}
                          onClick={() => onSelectEvent(b.event)}
                          {...dragHandlers(b.event)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Legend */}
      {showLegend && viewMode !== "agenda" && (

        <div className={cn("flex flex-wrap gap-3 text-[10px]", txtMuted)}>
          {Object.entries(ESTAGIO_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn("h-2.5 w-5 rounded-sm", ESTAGIO_PILL_COLORS[key])} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CalendarDays className={cn("h-8 w-8 mb-2", darkBg ? "text-white/30" : "text-muted-foreground/40")} />
          <p className={cn("text-sm", txtMuted)}>Nenhuma tarefa neste período</p>
          <p className={cn("text-xs mt-0.5", darkBg ? "text-white/40" : "text-muted-foreground/60")}>
            Defina prazos para visualizá-las aqui
          </p>
        </div>
      )}
    </div>
  );
}

function OverflowPopover({
  events, count, darkBg, colorStrategy, onSelectEvent,
}: {
  events: CalendarEvent[];
  count: number;
  darkBg: boolean;
  colorStrategy: ColorStrategy;
  onSelectEvent: (e: CalendarEvent) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded w-full text-left transition-colors",
            darkBg ? "text-white/50 hover:text-white hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          +{count} mais
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2 space-y-0.5" align="start">
        {events.map((ev) => (
          <EventChip
            key={ev.id}
            event={ev}
            darkBg={false}
            colorStrategy={colorStrategy}
            onClick={() => onSelectEvent(ev)}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** Visão "Agenda": lista cronológica dos dias com eventos do período. */
function AgendaList({
  events, days, darkBg, colorStrategy, onSelectEvent,
}: {
  events: CalendarEvent[];
  days: Date[];
  darkBg: boolean;
  colorStrategy: ColorStrategy;
  onSelectEvent: (e: CalendarEvent) => void;
}) {
  const porDia = useMemo(() => {
    return days
      .map((day) => {
        const key = getDateKey(day);
        const doDia = events.filter((ev) => {
          const ini = ev.data_inicio ? getDateKey(parseLocalDate(ev.data_inicio)!) : null;
          const fim = ev.data_prazo ? getDateKey(parseLocalDate(ev.data_prazo)!) : null;
          if (ini && fim) return key >= ini && key <= fim;
          return key === (ini ?? fim);
        });
        return { day, key, eventos: doDia };
      })
      .filter((d) => d.eventos.length > 0);
  }, [events, days]);

  if (porDia.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CalendarDays className={cn("h-8 w-8 mb-2", darkBg ? "text-white/30" : "text-muted-foreground/40")} />
        <p className={cn("text-sm", darkBg ? "text-white/60" : "text-muted-foreground")}>
          Nenhum compromisso neste período
        </p>
      </div>
    );
  }

  const hoje = getDateKey(getToday());

  return (
    <div className={cn("border rounded-lg divide-y", darkBg ? "border-white/10 divide-white/10" : "border-border divide-border")}>
      {porDia.map(({ day, key, eventos }) => (
        <div key={key} className="flex gap-4 p-3">
          <div className="w-20 shrink-0 text-right">
            <div className={cn(
              "text-2xl font-semibold leading-none tabular-nums",
              key === hoje ? "text-primary" : darkBg ? "text-white" : "text-foreground",
            )}>
              {format(day, "dd")}
            </div>
            <div className={cn("text-[11px] mt-1 capitalize", darkBg ? "text-white/50" : "text-muted-foreground")}>
              {format(day, "EEE, MMM", { locale: ptBR })}
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            {eventos.map((ev) => (
              <EventChip
                key={`${key}-${ev.id}`}
                event={ev}
                darkBg={darkBg}
                colorStrategy={colorStrategy}
                onClick={() => onSelectEvent(ev)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
