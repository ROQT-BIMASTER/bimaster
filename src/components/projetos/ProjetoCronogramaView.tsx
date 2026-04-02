import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjetoTarefas, ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { ProjetoFilters, ProjetoSort, EMPTY_FILTERS, DEFAULT_SORT } from "./ProjetoFilterSort";
import { applyProjetoFilters, applyProjetoSort, hasActiveFilters } from "@/lib/projetoFilterUtils";
import { parseLocalDate, formatLocalDate } from "@/utils/dateUtils";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  addDays, differenceInDays, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ZoomIn, ZoomOut, Calendar, Package, Filter,
  Loader2, User, Diamond,
} from "lucide-react";

import {
  STATUS_LABELS, ESTAGIO_LABELS, ESTAGIO_COLORS_CRONOGRAMA as ESTAGIO_COLORS,
} from "@/lib/projetoConstants";

type ZoomLevel = "week" | "month" | "quarter";

interface ProductLane {
  produtoId: string | null;
  produtoNome: string;
  fotoUrl: string | null;
  tarefas: ProjetoTarefa[];
}

interface TarefaProgress {
  subtasksDone: number;
  subtasksTotal: number;
  metasDone: number;
  metasTotal: number;
  percent: number;
}

interface MetaMarker {
  id: string;
  descricao: string;
  data_meta: string;
  concluida: boolean;
}

interface Props {
  projetoId: string;
  onSelectTarefa?: (tarefa: ProjetoTarefa) => void;
  darkBg?: boolean;
  filters?: ProjetoFilters;
  sort?: ProjetoSort;
}

export function ProjetoCronogramaView({ projetoId, onSelectTarefa, darkBg = false, filters = EMPTY_FILTERS, sort = DEFAULT_SORT }: Props) {
  const { tarefas: rawTarefas, secoes, tarefasLoading, secoesLoading } = useProjetoTarefas(projetoId);

  // Apply external filters
  const tarefas = useMemo(() => {
    let t: typeof rawTarefas = rawTarefas;
    if (hasActiveFilters(filters)) t = applyProjetoFilters(t, filters) as typeof rawTarefas;
    return applyProjetoSort(t, sort) as typeof rawTarefas;
  }, [rawTarefas, filters, sort]);
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

  // Fetch all metas for all parent tasks (batch)
  const parentTaskIds = useMemo(() => tarefas.filter(t => !t.parent_tarefa_id).map(t => t.id), [tarefas]);
  const { data: allMetas = [] } = useQuery({
    queryKey: ["cronograma-metas", projetoId, parentTaskIds.join(",")],
    queryFn: async () => {
      if (parentTaskIds.length === 0) return [];
      const { data } = await supabase
        .from("projeto_tarefa_metas" as any)
        .select("id, tarefa_id, descricao, data_meta, concluida")
        .in("tarefa_id", parentTaskIds);
      return (data || []) as unknown as { id: string; tarefa_id: string; descricao: string; data_meta: string | null; concluida: boolean }[];
    },
    enabled: parentTaskIds.length > 0,
  });

  // Build maps
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

  // Build progress map per task
  const progressMap = useMemo<Record<string, TarefaProgress>>(() => {
    const m: Record<string, TarefaProgress> = {};
    for (const parentId of parentTaskIds) {
      const subtasks = tarefas.filter(t => t.parent_tarefa_id === parentId);
      const subtasksDone = subtasks.filter(t => t.status === "concluida").length;
      const subtasksTotal = subtasks.length;

      const metas = allMetas.filter(mt => mt.tarefa_id === parentId);
      const metasDone = metas.filter(mt => mt.concluida).length;
      const metasTotal = metas.length;

      const totalItems = subtasksTotal + metasTotal;
      const doneItems = subtasksDone + metasDone;
      const percent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

      m[parentId] = { subtasksDone, subtasksTotal, metasDone, metasTotal, percent };
    }
    return m;
  }, [parentTaskIds, tarefas, allMetas]);

  // Build metas markers map per task (only those with dates)
  const metasMarkersMap = useMemo<Record<string, MetaMarker[]>>(() => {
    const m: Record<string, MetaMarker[]> = {};
    for (const meta of allMetas) {
      if (!meta.data_meta) continue;
      if (!m[meta.tarefa_id]) m[meta.tarefa_id] = [];
      m[meta.tarefa_id].push({ id: meta.id, descricao: meta.descricao, data_meta: meta.data_meta, concluida: meta.concluida });
    }
    return m;
  }, [allMetas]);

  // Filter tarefas
  const filteredTarefas = useMemo(() => {
    let t = tarefas.filter(t => !t.parent_tarefa_id);
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

    const pad = zoom === "week" ? 7 : zoom === "month" ? 14 : 30;
    const tStart = addDays(startOfWeek(earliest, { weekStartsOn: 1 }), -pad);
    const tEnd = addDays(endOfWeek(latest, { weekStartsOn: 1 }), pad);
    const dw = zoom === "week" ? 40 : zoom === "month" ? 18 : 6;

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
        return { label: `${format(w, "dd/MM", { locale: ptBR })}`, start: w, width: days * dw };
      });
    } else {
      const months = eachMonthOfInterval({ start: tStart, end: tEnd });
      cols = months.map(m => {
        const me = endOfMonth(m);
        const mStart = m < tStart ? tStart : m;
        const mEnd = me > tEnd ? tEnd : me;
        const days = differenceInDays(mEnd, mStart) + 1;
        return { label: format(m, "MMM yyyy", { locale: ptBR }), start: mStart, width: days * dw };
      });
    }

    return { timelineStart: tStart, timelineEnd: tEnd, dayWidth: dw, columns: cols };
  }, [filteredTarefas, zoom]);

  const totalWidth = useMemo(() => columns.reduce((acc, c) => acc + c.width, 0), [columns]);

  const todayOffset = useMemo(() => {
    const d = differenceInDays(new Date(), timelineStart);
    return d * dayWidth;
  }, [timelineStart, dayWidth]);

  const getBarStyle = (t: ProjetoTarefa) => {
    const start = parseLocalDate(t.created_at) || new Date();
    const end = parseLocalDate(t.data_prazo) || addDays(start, 5);
    const left = Math.max(0, differenceInDays(start, timelineStart) * dayWidth);
    const width = Math.max(dayWidth * 2, differenceInDays(end, start) * dayWidth);
    const color = ESTAGIO_COLORS[t.estagio || ""] || "hsl(210, 15%, 50%)";
    const isCompleted = t.status === "concluida";
    return { left, width, color, isCompleted, startDate: start, endDate: end };
  };

  const secaoMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of secoes) m[s.id] = s.nome;
    return m;
  }, [secoes]);

  if (tarefasLoading || secoesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className={`h-6 w-6 animate-spin ${darkBg ? "text-white/50" : "text-muted-foreground"}`} />
      </div>
    );
  }

  if (filteredTarefas.length === 0) {
    const totalParent = tarefas.filter(t => !t.parent_tarefa_id).length;
    const withoutDeadline = tarefas.filter(t => !t.parent_tarefa_id && !t.data_prazo).length;
    return (
      <div className={`flex flex-col items-center justify-center py-20 gap-2 ${darkBg ? "text-white/60" : "text-muted-foreground"}`}>
        <Calendar className="h-10 w-10 opacity-40" />
        <p className="text-sm">Nenhuma tarefa encontrada para exibir no cronograma.</p>
        {withoutDeadline > 0 && (
          <p className="text-xs text-warning">{withoutDeadline} de {totalParent} tarefas sem prazo definido — defina prazos para visualizá-las aqui.</p>
        )}
      </div>
    );
  }

  // Deadline warning banner
  const totalParentTasks = tarefas.filter(t => !t.parent_tarefa_id).length;
  const tasksWithoutDeadline = tarefas.filter(t => !t.parent_tarefa_id && !t.data_prazo).length;
  const showDeadlineBanner = totalParentTasks > 0 && (tasksWithoutDeadline / totalParentTasks) > 0.5;

  const LANE_LABEL_WIDTH = 260;
  const ROW_HEIGHT = 48;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className={`h-4 w-4 ${darkBg ? "text-white/60" : "text-muted-foreground"}`} />
            <Select value={filterSecao} onValueChange={setFilterSecao}>
              <SelectTrigger className={cn("h-8 w-[160px] text-xs", darkBg && "bg-white/10 border-white/20 text-white")}>
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
              <SelectTrigger className={cn("h-8 w-[140px] text-xs", darkBg && "bg-white/10 border-white/20 text-white")}>
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
            <Button variant="ghost" size="icon" className={cn("h-7 w-7", darkBg && "text-white hover:bg-white/10")} onClick={() => setZoom(z => z === "quarter" ? "month" : "week")}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Badge variant="outline" className={cn("text-[10px] px-2 h-6", darkBg && "border-white/20 text-white/70")}>
              {zoom === "week" ? "Dia" : zoom === "month" ? "Semana" : "Mês"}
            </Badge>
            <Button variant="ghost" size="icon" className={cn("h-7 w-7", darkBg && "text-white hover:bg-white/10")} onClick={() => setZoom(z => z === "week" ? "month" : "quarter")}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Gantt chart */}
        <div className={`border rounded-xl overflow-hidden ${darkBg ? "bg-white/5 border-white/15" : "bg-card"}`}>
          <div className="overflow-x-auto" ref={scrollRef}>
            <div className="flex" style={{ minWidth: totalWidth + LANE_LABEL_WIDTH }}>
              {/* Lane labels (fixed) */}
              <div className={`flex-shrink-0 border-r sticky left-0 z-10 ${darkBg ? "bg-white/5 border-white/10 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.3)]" : "bg-muted/30 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.1)]"}`} style={{ width: LANE_LABEL_WIDTH }}>
                <div className={`h-10 border-b px-3 flex items-center ${darkBg ? "border-white/10" : ""}`}>
                  <span className={`text-[11px] font-medium uppercase tracking-wider ${darkBg ? "text-white/60" : "text-muted-foreground"}`}>Produto</span>
                </div>
                {lanes.map((lane) => (
                  <div
                    key={lane.produtoId || "general"}
                    className={cn("border-b px-3 flex items-center gap-2", darkBg ? "border-white/10" : "")}
                    style={{ height: Math.max(ROW_HEIGHT, lane.tarefas.length * ROW_HEIGHT) }}
                  >
                    {lane.produtoId ? (
                      <ProductThumbnail src={lane.fotoUrl} size="sm" />
                    ) : (
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", darkBg ? "bg-white/10" : "bg-muted")}>
                        <Package className={cn("h-4 w-4", darkBg ? "text-white/50" : "text-muted-foreground")} />
                      </div>
                    )}
                    <span className={cn("text-xs font-medium line-clamp-2", darkBg ? "text-white" : "")}>{lane.produtoNome}</span>
                  </div>
                ))}
              </div>

              {/* Scrollable timeline */}
              <div className="flex-1">
                <div style={{ minWidth: totalWidth }}>
                  {/* Column headers */}
                  <div className={cn("h-10 border-b flex items-end", darkBg ? "border-white/10" : "")}>
                    {columns.map((col, i) => (
                      <div
                        key={i}
                        className={cn("flex-shrink-0 border-r px-1 flex flex-col items-center justify-center", darkBg ? "border-white/10" : "border-border/30")}
                        style={{ width: col.width }}
                      >
                        <span className={cn("text-[10px] leading-tight", darkBg ? "text-white/50" : "text-muted-foreground")}>{col.subLabel}</span>
                        <span className={cn("text-[11px] font-medium leading-tight", darkBg ? "text-white/80" : "")}>{col.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Rows */}
                  <div className="relative">
                    {/* Today line */}
                    {todayOffset > 0 && todayOffset < totalWidth && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-destructive z-20 pointer-events-none"
                        style={{ left: todayOffset }}
                      >
                        <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0.5 rounded-b font-medium">
                          Hoje
                        </div>
                      </div>
                    )}

                    {/* Grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {columns.map((col, i) => (
                        <div key={i} className={cn("flex-shrink-0 border-r", darkBg ? "border-white/5" : "border-border/10")} style={{ width: col.width }} />
                      ))}
                    </div>

                    {/* Lane rows */}
                    {lanes.map((lane) => {
                      const laneHeight = Math.max(ROW_HEIGHT, lane.tarefas.length * ROW_HEIGHT);
                      return (
                        <div
                          key={lane.produtoId || "general"}
                          className={cn("relative border-b", darkBg ? "border-white/10" : "")}
                          style={{ height: laneHeight }}
                        >
                          {lane.tarefas.map((t, ti) => {
                            const bar = getBarStyle(t);
                            const secaoNome = secaoMap[t.secao_id] || "";
                            const progress = progressMap[t.id];
                            const markers = metasMarkersMap[t.id] || [];
                            const hasProgress = progress && (progress.subtasksTotal > 0 || progress.metasTotal > 0);

                            return (
                              <Tooltip key={t.id}>
                                <TooltipTrigger asChild>
                                  <button
                                    className={cn(
                                      "absolute rounded-md h-7 flex items-center text-[11px] font-medium text-white transition-all hover:brightness-110 hover:shadow-md cursor-pointer group",
                                      bar.isCompleted && "opacity-60"
                                    )}
                                    style={{
                                      left: bar.left,
                                      width: bar.width,
                                      top: ti * ROW_HEIGHT + (ROW_HEIGHT - 28) / 2,
                                      backgroundColor: "transparent",
                                    }}
                                    onClick={() => onSelectTarefa?.(t)}
                                  >
                                    {/* Background (unfilled portion - darker/dimmed) */}
                                    <div
                                      className="absolute inset-0 rounded-md"
                                      style={{ backgroundColor: bar.color, opacity: hasProgress ? 0.35 : 1 }}
                                    />
                                    {/* Filled portion (progress) */}
                                    {hasProgress && progress.percent > 0 && (
                                      <div
                                        className="absolute inset-y-0 left-0 rounded-l-md"
                                        style={{
                                          width: `${progress.percent}%`,
                                          backgroundColor: bar.color,
                                          borderTopRightRadius: progress.percent >= 100 ? '0.375rem' : 0,
                                          borderBottomRightRadius: progress.percent >= 100 ? '0.375rem' : 0,
                                        }}
                                      />
                                    )}
                                    {/* Diamond markers for metas */}
                                    {markers.map((marker) => {
                                      const metaDate = parseLocalDate(marker.data_meta);
                                      if (!metaDate) return null;
                                      const taskDuration = differenceInDays(bar.endDate, bar.startDate);
                                      if (taskDuration <= 0) return null;
                                      const metaOffset = differenceInDays(metaDate, bar.startDate);
                                      const markerPercent = Math.max(0, Math.min(100, (metaOffset / taskDuration) * 100));
                                      return (
                                        <Tooltip key={marker.id}>
                                          <TooltipTrigger asChild>
                                            <div
                                              className="absolute z-10 pointer-events-auto"
                                              style={{
                                                left: `${markerPercent}%`,
                                                top: '50%',
                                                transform: 'translate(-50%, -50%) rotate(45deg)',
                                              }}
                                            >
                                              <div
                                                className={cn(
                                                  "h-2.5 w-2.5 border border-white/80",
                                                  marker.concluida ? "bg-emerald-400" : "bg-amber-400"
                                                )}
                                              />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">
                                            <div className="flex items-center gap-1.5">
                                              <Diamond className={cn("h-3 w-3", marker.concluida ? "text-emerald-500" : "text-amber-500")} />
                                              <span>{marker.descricao}</span>
                                              <span className="text-muted-foreground">
                                                ({formatLocalDate(marker.data_meta, "dd/MM")})
                                              </span>
                                            </div>
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                    {/* Label + progress % */}
                                    <div className="relative z-[5] flex items-center gap-1 px-2 w-full min-w-0">
                                      <span className={cn("truncate", bar.isCompleted && "line-through")}>{t.titulo}</span>
                                      {hasProgress && (
                                        <span className="flex-shrink-0 text-[9px] opacity-80 bg-black/20 rounded px-1">
                                          {progress.percent}%
                                        </span>
                                      )}
                                    </div>
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
                                    {hasProgress && (
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-2 text-xs">
                                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                            <div
                                              className="h-full rounded-full transition-all"
                                              style={{
                                                width: `${progress.percent}%`,
                                                backgroundColor: bar.color,
                                              }}
                                            />
                                          </div>
                                          <span className="text-[10px] font-medium">{progress.percent}%</span>
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex gap-3">
                                          {progress.subtasksTotal > 0 && (
                                            <span>Subtarefas: {progress.subtasksDone}/{progress.subtasksTotal}</span>
                                          )}
                                          {progress.metasTotal > 0 && (
                                            <span>Marcos: {progress.metasDone}/{progress.metasTotal}</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
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
              <span className={darkBg ? "text-white/60" : "text-muted-foreground"}>{ESTAGIO_LABELS[key]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-5 rounded-sm bg-destructive" />
            <span className={darkBg ? "text-white/60" : "text-muted-foreground"}>Hoje</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rotate-45 bg-amber-400 border border-muted-foreground/30" />
            <span className={darkBg ? "text-white/60" : "text-muted-foreground"}>Marco pendente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rotate-45 bg-emerald-400 border border-muted-foreground/30" />
            <span className={darkBg ? "text-white/60" : "text-muted-foreground"}>Marco concluído</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
