import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetoTarefas, ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { parseLocalDate, formatLocalDate } from "@/utils/dateUtils";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  addDays, addWeeks, addMonths, differenceInDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, format, isSameMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  isToday, subWeeks, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Calendar, Package, Filter,
  Loader2, User,
} from "lucide-react";

// ─── Stage colors (for bar fill) ───
const ESTAGIO_COLORS: Record<string, string> = {
  briefing: "hsl(270, 60%, 55%)",
  em_criacao: "hsl(210, 70%, 55%)",
  revisao: "hsl(40, 80%, 50%)",
  aprovado: "hsl(150, 60%, 45%)",
  producao: "hsl(330, 60%, 55%)",
  lancamento: "hsl(330, 60%, 55%)",
};
const ESTAGIO_LABELS: Record<string, string> = {
  briefing: "Briefing",
  em_criacao: "Em Criação",
  revisao: "Revisão",
  aprovado: "Aprovado",
  producao: "Produção",
  lancamento: "Lançamento",
};
const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
};

type ZoomLevel = "week" | "month" | "quarter";

interface ProductLane {
  produtoId: string | null;
  produtoNome: string;
  fotoUrl: string | null;
  tarefas: ProjetoTarefa[];
}

interface Props {
  projetoId: string;
  onSelectTarefa?: (tarefa: ProjetoTarefa) => void;
}

export function ProjetoCronogramaView({ projetoId, onSelectTarefa }: Props) {
  const { tarefas, secoes, tarefasLoading, secoesLoading } = useProjetoTarefas(projetoId);
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [filterSecao, setFilterSecao] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch product links
  const { data: produtoLinks = [] } = useQuery({
    queryKey: ["projeto-tarefa-produtos", projetoId],
    queryFn: async () => {
      const tarefaIds = tarefas.map(t => t.id);
      if (tarefaIds.length === 0) return [];
      const { data } = await supabase
        .from("projeto_tarefa_produtos" as any)
        .select("tarefa_id, produto_id")
        .in("tarefa_id", tarefaIds);
      return (data || []) as unknown as { tarefa_id: string; produto_id: string }[];
    },
    enabled: tarefas.length > 0,
  });

  // Fetch product info
  const produtoIds = [...new Set(produtoLinks.map(l => l.produto_id))];
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-info", produtoIds.join(",")],
    queryFn: async () => {
      if (produtoIds.length === 0) return [];
      const { data } = await supabase
        .from("fabrica_produtos" as any)
        .select("id, nome, foto_url")
        .in("id", produtoIds);
      return (data || []) as unknown as { id: string; nome: string; foto_url: string | null }[];
    },
    enabled: produtoIds.length > 0,
  });

  // Build a map tarefa -> produto
  const tarefaProdutoMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of produtoLinks) m[l.tarefa_id] = l.produto_id;
    return m;
  }, [produtoLinks]);

  const produtoMap = useMemo(() => {
    const m: Record<string, { id: string; nome: string; foto_url: string | null }> = {};
    for (const p of produtos) m[p.id] = p;
    return m;
  }, [produtos]);

  // Filter tarefas
  const filteredTarefas = useMemo(() => {
    let t = tarefas.filter(t => !t.parent_tarefa_id); // only parent tasks
    if (filterSecao !== "all") t = t.filter(x => x.secao_id === filterSecao);
    if (filterStatus !== "all") t = t.filter(x => x.status === filterStatus);
    return t;
  }, [tarefas, filterSecao, filterStatus]);

  // Build swim lanes
  const lanes = useMemo<ProductLane[]>(() => {
    const laneMap: Record<string, ProductLane> = {};
    const generalLane: ProductLane = { produtoId: null, produtoNome: "Geral", fotoUrl: null, tarefas: [] };

    for (const t of filteredTarefas) {
      const pid = tarefaProdutoMap[t.id];
      if (pid && produtoMap[pid]) {
        if (!laneMap[pid]) {
          laneMap[pid] = { produtoId: pid, produtoNome: produtoMap[pid].nome, fotoUrl: produtoMap[pid].foto_url, tarefas: [] };
        }
        laneMap[pid].tarefas.push(t);
      } else {
        generalLane.tarefas.push(t);
      }
    }

    const sorted = Object.values(laneMap).sort((a, b) => a.produtoNome.localeCompare(b.produtoNome));
    if (generalLane.tarefas.length > 0) sorted.push(generalLane);
    return sorted;
  }, [filteredTarefas, tarefaProdutoMap, produtoMap]);

  // Calculate timeline range
  const { timelineStart, timelineEnd, dayWidth, columns } = useMemo(() => {
    const today = new Date();
    let earliest = today;
    let latest = today;

    for (const t of filteredTarefas) {
      const start = parseLocalDate(t.created_at);
      const end = parseLocalDate(t.data_prazo) || (start ? addDays(start, 7) : null);
      if (start && start < earliest) earliest = start;
      if (end && end > latest) latest = end;
    }

    // Add padding
    const pad = zoom === "week" ? 7 : zoom === "month" ? 14 : 30;
    const tStart = addDays(startOfWeek(earliest, { weekStartsOn: 1 }), -pad);
    const tEnd = addDays(endOfWeek(latest, { weekStartsOn: 1 }), pad);

    const dw = zoom === "week" ? 40 : zoom === "month" ? 18 : 6;

    // Column headers
    let cols: { label: string; subLabel?: string; start: Date; width: number }[] = [];
    if (zoom === "week") {
      const days = eachDayOfInterval({ start: tStart, end: tEnd });
      cols = days.map(d => ({
        label: format(d, "dd", { locale: ptBR }),
        subLabel: format(d, "EEE", { locale: ptBR }),
        start: d,
        width: dw,
      }));
    } else if (zoom === "month") {
      const weeks = eachWeekOfInterval({ start: tStart, end: tEnd }, { weekStartsOn: 1 });
      cols = weeks.map(w => {
        const we = endOfWeek(w, { weekStartsOn: 1 });
        const days = differenceInDays(we > tEnd ? tEnd : we, w) + 1;
        return {
          label: `${format(w, "dd/MM", { locale: ptBR })}`,
          start: w,
          width: days * dw,
        };
      });
    } else {
      const months = eachMonthOfInterval({ start: tStart, end: tEnd });
      cols = months.map(m => {
        const me = endOfMonth(m);
        const mStart = m < tStart ? tStart : m;
        const mEnd = me > tEnd ? tEnd : me;
        const days = differenceInDays(mEnd, mStart) + 1;
        return {
          label: format(m, "MMM yyyy", { locale: ptBR }),
          start: mStart,
          width: days * dw,
        };
      });
    }

    return { timelineStart: tStart, timelineEnd: tEnd, dayWidth: dw, columns: cols };
  }, [filteredTarefas, zoom]);

  const totalWidth = useMemo(() => {
    return columns.reduce((acc, c) => acc + c.width, 0);
  }, [columns]);

  // Today marker position
  const todayOffset = useMemo(() => {
    const d = differenceInDays(new Date(), timelineStart);
    return d * dayWidth;
  }, [timelineStart, dayWidth]);

  // Bar position for a task
  const getBarStyle = (t: ProjetoTarefa) => {
    const start = parseLocalDate(t.created_at) || new Date();
    const end = parseLocalDate(t.data_prazo) || addDays(start, 5);
    const left = Math.max(0, differenceInDays(start, timelineStart) * dayWidth);
    const width = Math.max(dayWidth * 2, differenceInDays(end, start) * dayWidth);
    const color = ESTAGIO_COLORS[t.estagio || ""] || "hsl(210, 15%, 50%)";
    const isCompleted = t.status === "concluida";
    return { left, width, color, isCompleted };
  };

  // Section color helper
  const secaoMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of secoes) m[s.id] = s.nome;
    return m;
  }, [secoes]);

  if (tarefasLoading || secoesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filteredTarefas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
        <Calendar className="h-10 w-10 opacity-40" />
        <p className="text-sm">Nenhuma tarefa encontrada para exibir no cronograma.</p>
        <p className="text-xs">Crie tarefas com prazos para visualizá-las aqui.</p>
      </div>
    );
  }

  const LANE_LABEL_WIDTH = 260;
  const ROW_HEIGHT = 48;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterSecao} onValueChange={setFilterSecao}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Seção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as seções</SelectItem>
                {secoes.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="bloqueada">Bloqueada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => z === "quarter" ? "month" : "week")}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Badge variant="outline" className="text-[10px] px-2 h-6">
              {zoom === "week" ? "Dia" : zoom === "month" ? "Semana" : "Mês"}
            </Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => z === "week" ? "month" : "quarter")}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Gantt chart */}
        <div className="border rounded-xl overflow-hidden bg-card">
          <div className="overflow-x-auto" ref={scrollRef}>
            <div className="flex" style={{ minWidth: totalWidth + LANE_LABEL_WIDTH }}>
            {/* Lane labels (fixed) */}
            <div className="flex-shrink-0 border-r bg-muted/30 sticky left-0 z-10 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.1)]" style={{ width: LANE_LABEL_WIDTH }}>
              {/* Header spacer */}
              <div className="h-10 border-b px-3 flex items-center">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Produto</span>
              </div>
              {lanes.map((lane, li) => (
                <div
                  key={lane.produtoId || "general"}
                  className="border-b px-3 flex items-center gap-2"
                  style={{ height: Math.max(ROW_HEIGHT, lane.tarefas.length * ROW_HEIGHT) }}
                >
                  {lane.produtoId ? (
                    <ProductThumbnail src={lane.fotoUrl} size="sm" />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-xs font-medium line-clamp-2">{lane.produtoNome}</span>
                </div>
              ))}
            </div>

            {/* Scrollable timeline */}
            <div className="flex-1">
              <div style={{ minWidth: totalWidth }}>
                {/* Column headers */}
                <div className="h-10 border-b flex items-end">
                  {columns.map((col, i) => (
                    <div
                      key={i}
                      className="flex-shrink-0 border-r border-border/30 px-1 flex flex-col items-center justify-center"
                      style={{ width: col.width }}
                    >
                      <span className="text-[10px] text-muted-foreground leading-tight">{col.subLabel}</span>
                      <span className="text-[11px] font-medium leading-tight">{col.label}</span>
                    </div>
                  ))}
                </div>

                {/* Rows */}
                <div className="relative">
                  {/* Today line */}
                  {todayOffset > 0 && todayOffset < totalWidth && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                      style={{ left: todayOffset }}
                    >
                      <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-b font-medium">
                        Hoje
                      </div>
                    </div>
                  )}

                  {/* Grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {columns.map((col, i) => (
                      <div key={i} className="flex-shrink-0 border-r border-border/10" style={{ width: col.width }} />
                    ))}
                  </div>

                  {/* Lane rows */}
                  {lanes.map((lane) => {
                    const laneHeight = Math.max(ROW_HEIGHT, lane.tarefas.length * ROW_HEIGHT);
                    return (
                      <div
                        key={lane.produtoId || "general"}
                        className="relative border-b"
                        style={{ height: laneHeight }}
                      >
                        {lane.tarefas.map((t, ti) => {
                          const bar = getBarStyle(t);
                          const secaoNome = secaoMap[t.secao_id] || "";
                          return (
                            <Tooltip key={t.id}>
                              <TooltipTrigger asChild>
                                <button
                                  className={cn(
                                    "absolute rounded-md h-7 flex items-center px-2 gap-1 text-[11px] font-medium text-white transition-all hover:brightness-110 hover:shadow-md cursor-pointer truncate",
                                    bar.isCompleted && "opacity-50 line-through"
                                  )}
                                  style={{
                                    left: bar.left,
                                    width: bar.width,
                                    top: ti * ROW_HEIGHT + (ROW_HEIGHT - 28) / 2,
                                    backgroundColor: bar.color,
                                  }}
                                  onClick={() => onSelectTarefa?.(t)}
                                >
                                  <span className="truncate">{t.titulo}</span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold text-sm">{t.titulo}</p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{secaoNome}</span>
                                    <span>•</span>
                                    <span>{ESTAGIO_LABELS[t.estagio || ""] || "Sem estágio"}</span>
                                    <span>•</span>
                                    <span>{STATUS_LABELS[t.status] || t.status}</span>
                                  </div>
                                  {t.responsavel && (
                                    <div className="flex items-center gap-1 text-xs">
                                      <User className="h-3 w-3" />
                                      <span>{t.responsavel.nome}</span>
                                    </div>
                                  )}
                                  <div className="text-[10px] text-muted-foreground">
                                    {formatLocalDate(t.created_at, "dd/MM")} → {t.data_prazo ? formatLocalDate(t.data_prazo, "dd/MM") : "sem prazo"}
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-[10px]">
          {Object.entries(ESTAGIO_COLORS).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="h-2.5 w-5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground">{ESTAGIO_LABELS[key]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-5 rounded-sm bg-red-500" />
            <span className="text-muted-foreground">Hoje</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
