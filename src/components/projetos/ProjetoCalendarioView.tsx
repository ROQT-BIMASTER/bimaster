import { useState, useMemo, useEffect } from "react";
import { useProjetoTarefas, ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { ProjetoFilters, ProjetoSort, EMPTY_FILTERS, DEFAULT_SORT } from "./ProjetoFilterSort";
import { applyProjetoFilters, applyProjetoSort, hasActiveFilters } from "@/lib/projetoFilterUtils";
import { getDateKey, parseLocalDate, getToday } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { CalendarioAnalisePanel } from "./CalendarioAnalisePanel";
import { ChevronLeft, ChevronRight, CalendarDays, Circle, CheckCircle2, BarChart3 } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks,
  format, isSameMonth, isToday as isDateToday, isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  ESTAGIO_LABELS, ESTAGIO_PILL_COLORS, STATUS_ICON_CONFIG,
} from "@/lib/projetoConstants";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface Props {
  projetoId: string;
  darkBg?: boolean;
  filters?: ProjetoFilters;
  sort?: ProjetoSort;
}

export function ProjetoCalendarioView({ projetoId, darkBg = false, filters = EMPTY_FILTERS, sort = DEFAULT_SORT }: Props) {
  const { tarefas: rawTarefas, secoes } = useProjetoTarefas(projetoId);

  // Apply external filters
  const tarefas = useMemo(() => {
    let t: typeof rawTarefas = rawTarefas;
    if (hasActiveFilters(filters)) t = applyProjetoFilters(t, filters) as typeof rawTarefas;
    return applyProjetoSort(t, sort) as typeof rawTarefas;
  }, [rawTarefas, filters, sort]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [filterSecao, setFilterSecao] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedTarefaId, setSelectedTarefaId] = useState<string | null>(null);
  const [showAnalisePanel, setShowAnalisePanel] = useState(false);

  // Period boundaries for analysis
  const periodoInfo = useMemo(() => {
    if (viewMode === "month") {
      return {
        inicio: startOfMonth(currentDate),
        fim: endOfMonth(currentDate),
        label: format(currentDate, "'Mês de' MMMM yyyy", { locale: ptBR }),
      };
    }
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    const we = endOfWeek(currentDate, { weekStartsOn: 1 });
    return {
      inicio: ws,
      fim: we,
      label: `Semana de ${format(ws, "dd MMM", { locale: ptBR })} – ${format(we, "dd MMM", { locale: ptBR })}`,
    };
  }, [currentDate, viewMode]);

  // Group tasks by date key
  const tasksByDate = useMemo(() => {
    const map: Record<string, ProjetoTarefa[]> = {};
    const filtered = tarefas.filter((t) => {
      if (!t.data_prazo) return false;
      if (filterSecao !== "all" && t.secao_id !== filterSecao) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      return true;
    });
    filtered.forEach((t) => {
      const key = getDateKey(t.data_prazo);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tarefas, filterSecao, filterStatus]);

  // Compute grid days
  const days = useMemo(() => {
    if (viewMode === "month") {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: gridStart, end: gridEnd });
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    }
  }, [currentDate, viewMode]);

  const navigate = (dir: "prev" | "next") => {
    if (viewMode === "month") {
      setCurrentDate(dir === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    } else {
      setCurrentDate(dir === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const goToday = () => setCurrentDate(new Date());

  const txt = darkBg ? "text-white" : "text-foreground";
  const txtMuted = darkBg ? "text-white/60" : "text-muted-foreground";
  const border = darkBg ? "border-white/10" : "border-border/40";
  const cellBg = darkBg ? "bg-white/[0.03]" : "bg-background";
  const cellBgToday = darkBg ? "bg-white/10" : "bg-primary/5";
  const cellBgOutside = darkBg ? "bg-transparent" : "bg-muted/30";
  const btnGhost = darkBg ? "text-white hover:bg-white/10" : "";

  const maxVisible = viewMode === "month" ? 3 : 20;

  // If analysis panel is open, render it full-width instead of the calendar
  if (showAnalisePanel) {
    return (
      <div className="space-y-4">
        <div className={cn("flex items-center justify-between flex-wrap gap-3")}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className={cn("h-8 w-8", btnGhost)} onClick={() => navigate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn("text-lg font-semibold capitalize min-w-[180px] text-center cursor-pointer hover:opacity-80 transition-opacity", txt)}>
                  {viewMode === "month"
                    ? format(currentDate, "MMMM yyyy", { locale: ptBR })
                    : `Semana de ${format(days[0], "dd MMM", { locale: ptBR })} – ${format(days[6], "dd MMM", { locale: ptBR })}`}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
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
            <div className={cn("flex rounded-md border overflow-hidden ml-2", border)}>
              <button onClick={() => setViewMode("month")} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "month" ? (darkBg ? "bg-white/20 text-white" : "bg-primary text-primary-foreground") : (darkBg ? "text-white/60 hover:bg-white/10" : "text-muted-foreground hover:bg-muted"))}>Mês</button>
              <button onClick={() => setViewMode("week")} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "week" ? (darkBg ? "bg-white/20 text-white" : "bg-primary text-primary-foreground") : (darkBg ? "text-white/60 hover:bg-white/10" : "text-muted-foreground hover:bg-muted"))}>Semana</button>
            </div>
          </div>
        </div>
        <CalendarioAnalisePanel
          projetoId={projetoId}
          tarefas={tarefas}
          secoes={secoes}
          periodoInicio={periodoInfo.inicio}
          periodoFim={periodoInfo.fim}
          periodoLabel={periodoInfo.label}
          darkBg={darkBg}
          onClose={() => setShowAnalisePanel(false)}
        />
      </div>
    );
  }

  // Deadline warning
  const totalParentTasks = tarefas.filter(t => !t.parent_tarefa_id).length;
  const tasksWithoutDeadline = tarefas.filter(t => !t.parent_tarefa_id && !t.data_prazo).length;
  const showDeadlineBanner = totalParentTasks > 0 && (tasksWithoutDeadline / totalParentTasks) > 0.5;

  return (
    <div className="space-y-4">
      {/* Deadline warning banner */}
      {showDeadlineBanner && (
        <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs", "bg-warning/10 text-warning")}>
          <CalendarDays className="h-4 w-4 flex-shrink-0" />
          <span>{tasksWithoutDeadline} de {totalParentTasks} tarefas sem prazo — defina prazos para visualizá-las no calendário.</span>
        </div>
      )}
      {/* Toolbar */}
      <div className={cn("flex items-center justify-between flex-wrap gap-3")}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", btnGhost)} onClick={() => navigate("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn("text-lg font-semibold capitalize min-w-[180px] text-center cursor-pointer hover:opacity-80 transition-opacity", txt)}>
                {viewMode === "month"
                  ? format(currentDate, "MMMM yyyy", { locale: ptBR })
                  : `Semana de ${format(days[0], "dd MMM", { locale: ptBR })} – ${format(days[6], "dd MMM", { locale: ptBR })}`}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
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
          <Button variant="outline" size="sm" className={cn("h-8 text-xs ml-2", darkBg && "bg-white/10 border-white/20 text-white hover:bg-white/20")} onClick={goToday}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-8 text-xs ml-1 gap-1.5", darkBg && "bg-white/10 border-white/20 text-white hover:bg-white/20")}
            onClick={() => setShowAnalisePanel(true)}
          >
            <BarChart3 className="h-3.5 w-3.5" /> Análise
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className={cn("flex rounded-md border overflow-hidden", border)}>
            <button onClick={() => setViewMode("month")} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "month" ? (darkBg ? "bg-white/20 text-white" : "bg-primary text-primary-foreground") : (darkBg ? "text-white/60 hover:bg-white/10" : "text-muted-foreground hover:bg-muted"))}>Mês</button>
            <button onClick={() => setViewMode("week")} className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "week" ? (darkBg ? "bg-white/20 text-white" : "bg-primary text-primary-foreground") : (darkBg ? "text-white/60 hover:bg-white/10" : "text-muted-foreground hover:bg-muted"))}>Semana</button>
          </div>
          {hasActiveFilters(filters) ? (
            <Badge variant="outline" className={cn("text-[10px] h-6 gap-1", darkBg && "border-white/20 text-white/70")}>
              <CalendarDays className="h-3 w-3" /> Filtros ativos via toolbar
            </Badge>
          ) : (
            <>
              <Select value={filterSecao} onValueChange={setFilterSecao}>
                <SelectTrigger className={cn("h-8 w-[140px] text-xs", darkBg && "bg-white/10 border-white/20 text-white")}><SelectValue placeholder="Seção" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas seções</SelectItem>
                  {secoes.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className={cn("h-8 w-[140px] text-xs", darkBg && "bg-white/10 border-white/20 text-white")}><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="pendente">Não iniciado</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluído</SelectItem>
                  <SelectItem value="bloqueada">Bloqueada</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className={cn("border rounded-lg overflow-hidden", border)}>
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div key={d} className={cn("text-center text-xs font-semibold py-2 border-b", border, darkBg ? "bg-white/5 text-white/70" : "bg-muted/50 text-muted-foreground")}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = getDateKey(day);
            const dayTasks = tasksByDate[key] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const today = isDateToday(day);
            return (
              <div key={i} className={cn("border-b border-r min-h-[100px] p-1.5 transition-colors", border, today ? cellBgToday : isCurrentMonth ? cellBg : cellBgOutside, viewMode === "week" && "min-h-[200px]")}>
                <div className={cn("text-right mb-1")}>
                  <span className={cn("inline-flex items-center justify-center text-xs font-medium w-6 h-6 rounded-full", today ? "bg-primary text-primary-foreground" : isCurrentMonth ? txt : txtMuted)}>{format(day, "d")}</span>
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, maxVisible).map((t) => (<TaskPill key={t.id} tarefa={t} darkBg={darkBg} onClick={() => setSelectedTarefaId(t.id)} />))}
                  {dayTasks.length > maxVisible && (<OverflowPopover tasks={dayTasks.slice(maxVisible)} count={dayTasks.length - maxVisible} darkBg={darkBg} onClickTask={setSelectedTarefaId} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className={cn("flex flex-wrap gap-3 text-[10px]", txtMuted)}>
        {Object.entries(ESTAGIO_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-5 rounded-sm", ESTAGIO_PILL_COLORS[key])} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Task detail panel */}
      {selectedTarefaId && (
        <TaskDetailPanel tarefaId={selectedTarefaId} tarefas={tarefas} darkBg={darkBg} onClose={() => setSelectedTarefaId(null)} />
      )}
    </div>
  );
}

// ─── Task Pill ───
function TaskPill({ tarefa, darkBg, onClick }: { tarefa: ProjetoTarefa; darkBg: boolean; onClick: () => void }) {
  const stageColor = ESTAGIO_PILL_COLORS[tarefa.estagio || ""] || "bg-muted-foreground/50";
  const cfg = STATUS_ICON_CONFIG[tarefa.status] || STATUS_ICON_CONFIG.pendente;
  const StatusIcon = cfg.completed ? CheckCircle2 : Circle;
  const isCompleted = cfg.completed;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 w-full text-left rounded px-1.5 py-0.5 text-[11px] leading-tight transition-colors group",
        darkBg ? "hover:bg-white/10" : "hover:bg-muted/60",
        isCompleted && "opacity-60",
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", stageColor)} />
      <StatusIcon className={cn("h-3 w-3 shrink-0", cfg.className)} />
      <span className={cn(
        "truncate flex-1 font-medium",
        darkBg ? "text-white" : "text-foreground",
        isCompleted && "line-through",
      )}>
        {tarefa.titulo}
      </span>
      {tarefa.responsavel && (
        <Avatar className="h-4 w-4 shrink-0">
          <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
          <AvatarFallback className="text-[7px]">{tarefa.responsavel.nome?.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
    </button>
  );
}

// ─── Overflow "+N" Popover ───
function OverflowPopover({ tasks, count, darkBg, onClickTask }: { tasks: ProjetoTarefa[]; count: number; darkBg: boolean; onClickTask: (id: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(
          "text-[10px] font-medium px-1.5 py-0.5 rounded w-full text-left transition-colors",
          darkBg ? "text-white/50 hover:text-white hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        )}>
          +{count} mais
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 space-y-0.5" align="start">
        {tasks.map((t) => (
          <TaskPill key={t.id} tarefa={t} darkBg={false} onClick={() => onClickTask(t.id)} />
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Inline detail panel ───
function TaskDetailPanel({ tarefaId, tarefas, darkBg, onClose }: { tarefaId: string; tarefas: ProjetoTarefa[]; darkBg: boolean; onClose: () => void }) {
  const tarefa = tarefas.find((t) => t.id === tarefaId);
  if (!tarefa) return null;

  const cfg2 = STATUS_ICON_CONFIG[tarefa.status] || STATUS_ICON_CONFIG.pendente;
  const StatusIcon = cfg2.completed ? CheckCircle2 : Circle;
  const stageLabel = ESTAGIO_LABELS[tarefa.estagio || ""] || "—";

  return (
    <div className={cn(
      "fixed inset-y-0 right-0 w-80 z-50 shadow-2xl border-l p-5 overflow-y-auto animate-in slide-in-from-right-5",
      darkBg ? "bg-zinc-900 border-white/10 text-white" : "bg-background border-border",
    )}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={cn("font-semibold text-sm", darkBg ? "text-white" : "text-foreground")}>{tarefa.titulo}</h3>
        <Button variant="ghost" size="icon" className={cn("h-7 w-7", darkBg && "text-white hover:bg-white/10")} onClick={onClose}>✕</Button>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-4 w-4", cfg2.className)} />
          <span className={darkBg ? "text-white/70" : "text-muted-foreground"}>
            {tarefa.status === "concluida" ? "Concluído" : tarefa.status === "em_andamento" ? "Em andamento" : tarefa.status === "bloqueada" ? "Bloqueada" : "Não iniciado"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className={cn("h-4 w-4", darkBg ? "text-white/50" : "text-muted-foreground")} />
          <span className={darkBg ? "text-white/70" : "text-muted-foreground"}>
            {tarefa.data_prazo ? format(parseLocalDate(tarefa.data_prazo)!, "dd/MM/yyyy") : "Sem prazo"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", ESTAGIO_PILL_COLORS[tarefa.estagio || ""] || "bg-muted-foreground/50")} />
          <span className={darkBg ? "text-white/70" : "text-muted-foreground"}>{stageLabel}</span>
        </div>
        {tarefa.responsavel && (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
              <AvatarFallback className="text-[8px]">{tarefa.responsavel.nome?.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className={darkBg ? "text-white/70" : "text-muted-foreground"}>{tarefa.responsavel.nome}</span>
          </div>
        )}
        {tarefa.descricao && (
          <p className={cn("text-xs mt-2 whitespace-pre-wrap", darkBg ? "text-white/60" : "text-muted-foreground")}>{tarefa.descricao}</p>
        )}
      </div>
    </div>
  );
}
