import { useState, useRef } from "react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, differenceInDays, isSameMonth, eachMonthOfInterval, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import ProductThumbnail from "./ProductThumbnail";
import CountdownBadge from "./CountdownBadge";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Calendar as CalendarIcon } from "lucide-react";

interface Lancamento {
  id: string;
  nome_lancamento: string;
  data_prevista: string;
  data_efetiva: string | null;
  status: string;
  prioridade: string;
  tipo: string;
  fabrica_produtos?: { nome: string; codigo: string; foto_url?: string | null } | null;
  profiles?: { nome: string } | null;
}

interface LaunchTimelineProps {
  lancamentos: Lancamento[];
  onLancamentoClick: (lancamento: Lancamento) => void;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
  planejado: { label: "Planejado", color: "text-blue-700 dark:text-blue-300", bgColor: "bg-blue-100 dark:bg-blue-900/30", dotColor: "bg-blue-500" },
  em_preparacao: { label: "Em Preparação", color: "text-amber-700 dark:text-amber-300", bgColor: "bg-amber-100 dark:bg-amber-900/30", dotColor: "bg-amber-500" },
  aprovado: { label: "Aprovado", color: "text-green-700 dark:text-green-300", bgColor: "bg-green-100 dark:bg-green-900/30", dotColor: "bg-green-500" },
  lancado: { label: "Lançado", color: "text-purple-700 dark:text-purple-300", bgColor: "bg-purple-100 dark:bg-purple-900/30", dotColor: "bg-purple-500" },
  cancelado: { label: "Cancelado", color: "text-red-700 dark:text-red-300", bgColor: "bg-red-100 dark:bg-red-900/30", dotColor: "bg-red-500" },
};

const prioridadeConfig: Record<string, { color: string }> = {
  alta: { color: "ring-2 ring-red-500/50" },
  media: { color: "ring-2 ring-amber-500/50" },
  baixa: { color: "ring-2 ring-green-500/50" },
};

export default function LaunchTimeline({ lancamentos, onLancamentoClick }: LaunchTimelineProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [zoom, setZoom] = useState(3); // 1 = ano, 2 = mês, 3 = semana, 4 = dia
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculate date range based on zoom
  const getDateRange = () => {
    switch (zoom) {
      case 1: // Year view
        return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
      case 2: // Month view
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
      case 3: // Week view
        return { start: subMonths(startOfMonth(currentDate), 0), end: addMonths(endOfMonth(currentDate), 0) };
      case 4: // Day view (show 2 weeks)
      default:
        return { start: subMonths(startOfMonth(currentDate), 0), end: endOfMonth(currentDate) };
    }
  };

  const { start, end } = getDateRange();
  const months = eachMonthOfInterval({ start, end });
  const totalDays = differenceInDays(end, start) + 1;
  
  // Calculate pixel width per day based on zoom
  const dayWidth = zoom === 1 ? 4 : zoom === 2 ? 12 : zoom === 3 ? 24 : 48;
  const timelineWidth = totalDays * dayWidth;

  // Position of today marker
  const today = new Date();
  const todayPosition = differenceInDays(today, start);
  const todayIsVisible = todayPosition >= 0 && todayPosition <= totalDays;

  // Group lancamentos by vertical position to avoid overlap
  const positionedLancamentos = lancamentos
    .filter(l => {
      const date = new Date(l.data_prevista);
      return date >= start && date <= end;
    })
    .map(l => {
      const date = new Date(l.data_prevista);
      const dayOffset = differenceInDays(date, start);
      const xPosition = dayOffset * dayWidth;
      return { ...l, xPosition };
    })
    .sort((a, b) => a.xPosition - b.xPosition);

  // Simple row assignment for non-overlapping cards
  const assignedRows: { lancamento: typeof positionedLancamentos[0]; row: number }[] = [];
  const cardWidth = zoom === 1 ? 80 : zoom === 2 ? 140 : zoom === 3 ? 180 : 220;
  
  positionedLancamentos.forEach(l => {
    let row = 0;
    const endPosition = l.xPosition + cardWidth;
    
    while (assignedRows.some(a => 
      a.row === row && 
      !(l.xPosition >= a.lancamento.xPosition + cardWidth || endPosition <= a.lancamento.xPosition)
    )) {
      row++;
    }
    
    assignedRows.push({ lancamento: l, row });
  });

  const maxRows = Math.max(1, ...assignedRows.map(a => a.row + 1));
  const timelineHeight = maxRows * 90 + 60;

  const handlePrevious = () => {
    switch (zoom) {
      case 1:
        setCurrentDate(subMonths(currentDate, 12));
        break;
      case 2:
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case 3:
        setCurrentDate(subMonths(currentDate, 1));
        break;
      default:
        setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const handleNext = () => {
    switch (zoom) {
      case 1:
        setCurrentDate(addMonths(currentDate, 12));
        break;
      case 2:
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case 3:
        setCurrentDate(addMonths(currentDate, 1));
        break;
      default:
        setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const scrollToToday = () => {
    if (scrollRef.current && todayIsVisible) {
      const scrollPosition = todayPosition * dayWidth - scrollRef.current.clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollPosition, behavior: "smooth" });
    } else {
      setCurrentDate(new Date());
    }
  };

  const zoomLabels = ["Ano", "Mês", "Semana", "Dia"];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-[140px] text-center">
            {zoom === 1 ? format(currentDate, "yyyy") : format(start, "MMM", { locale: ptBR })} - {format(end, "MMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={scrollToToday} className="gap-1.5">
            <CalendarIcon className="h-4 w-4" />
            Hoje
          </Button>
          
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={4}
              step={1}
              onValueChange={(v) => setZoom(v[0])}
              className="w-28"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground w-14">{zoomLabels[zoom - 1]}</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(statusConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("h-3 w-3 rounded-full", config.dotColor)} />
            <span className="text-xs text-muted-foreground">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div 
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden rounded-xl border bg-muted/20 scrollbar-thin"
        style={{ height: timelineHeight }}
      >
        <div className="relative" style={{ width: timelineWidth, height: "100%" }}>
          {/* Month headers */}
          <div className="sticky top-0 z-10 flex bg-background/95 backdrop-blur border-b">
            {months.map((month, index) => {
              const monthStart = index === 0 ? start : startOfMonth(month);
              const monthEnd = index === months.length - 1 ? end : endOfMonth(month);
              const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
              const monthWidth = daysInMonth * dayWidth;
              
              return (
                <div
                  key={month.toISOString()}
                  className={cn(
                    "text-sm font-medium py-2 px-3 border-r flex-shrink-0 capitalize",
                    isSameMonth(month, today) && "bg-primary/5"
                  )}
                  style={{ width: monthWidth }}
                >
                  {format(month, zoom === 1 ? "MMM" : "MMMM yyyy", { locale: ptBR })}
                </div>
              );
            })}
          </div>

          {/* Timeline line */}
          <div className="absolute left-0 right-0 top-16 h-0.5 bg-border/50" />

          {/* Today marker */}
          {todayIsVisible && (
            <div
              className="absolute top-10 w-0.5 bg-primary z-20"
              style={{ left: todayPosition * dayWidth, height: timelineHeight - 40 }}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap">
                Hoje
              </div>
            </div>
          )}

          {/* Lancamento cards */}
          {assignedRows.map(({ lancamento, row }) => (
            <div
              key={lancamento.id}
              onClick={() => onLancamentoClick(lancamento)}
              className={cn(
                "absolute cursor-pointer transition-all duration-200 hover:scale-105 hover:z-30",
                "bg-background border rounded-lg shadow-sm hover:shadow-lg overflow-hidden",
                prioridadeConfig[lancamento.prioridade]?.color
              )}
              style={{
                left: lancamento.xPosition,
                top: 56 + row * 85,
                width: cardWidth,
                minHeight: 70,
              }}
            >
              <div className={cn("h-1 w-full", statusConfig[lancamento.status]?.dotColor)} />
              <div className="p-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <ProductThumbnail 
                    src={lancamento.fabrica_produtos?.foto_url} 
                    size="sm" 
                    className={zoom === 1 ? "h-5 w-5" : "h-6 w-6"} 
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium truncate",
                      zoom === 1 ? "text-[10px]" : "text-xs"
                    )}>
                      {lancamento.nome_lancamento}
                    </p>
                    {zoom > 1 && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {lancamento.fabrica_produtos?.nome}
                      </p>
                    )}
                  </div>
                </div>
                
                {zoom > 1 && (
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className={cn(
                      "text-[9px] h-4 px-1",
                      statusConfig[lancamento.status]?.bgColor,
                      statusConfig[lancamento.status]?.color
                    )}>
                      {statusConfig[lancamento.status]?.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(lancamento.data_prevista), "dd/MM")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
