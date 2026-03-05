import { useState, useMemo } from "react";
import { useProjetoTarefas, ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { getDateKey, parseLocalDate, getToday } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CalendarDays, Circle, CheckCircle2 } from "lucide-react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks,
  format, isSameMonth, isToday as isDateToday, isSameDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Stage colors for pills ───
const ESTAGIO_PILL_COLORS: Record<string, string> = {
  briefing: "bg-purple-500",
  em_criacao: "bg-blue-500",
  revisao: "bg-amber-500",
  aprovado: "bg-emerald-500",
  producao: "bg-pink-500",
  lancamento: "bg-pink-500",
};

const ESTAGIO_LABELS: Record<string, string> = {
  briefing: "Briefing",
  em_criacao: "Em Criação",
  revisao: "Revisão",
  aprovado: "Aprovado",
  producao: "Produção",
  lancamento: "Lançamento",
};

const STATUS_ICONS: Record<string, { icon: typeof Circle; className: string }> = {
  pendente: { icon: Circle, className: "text-muted-foreground" },
  nao_iniciado: { icon: Circle, className: "text-pink-500" },
  em_andamento: { icon: Circle, className: "text-amber-500" },
  concluida: { icon: CheckCircle2, className: "text-emerald-500" },
  bloqueada: { icon: Circle, className: "text-red-500" },
};

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface Props {
  projetoId: string;
  darkBg?: boolean;
}

export function ProjetoCalendarioView({ projetoId, darkBg = false }: Props) {
  const { tarefas, secoes } = useProjetoTarefas(projetoId);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [filterSecao, setFilterSecao] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedTarefaId, setSelectedTarefaId] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className={cn("flex items-center justify-between flex-wrap gap-3")}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", btnGhost)} onClick={() => navigate("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className={cn("text-lg font-semibold capitalize min-w-[180px] text-center", txt)}>
            {viewMode === "month"
              ? format(currentDate, "MMMM yyyy", { locale: ptBR })
              : `Semana de ${format(days[0], "dd MMM", { locale: ptBR })} – ${format(days[6], "dd MMM", { locale: ptBR })}`}
          </h2>
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", btnGhost)} onClick={() => navigate("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className={cn("h-8 text-xs ml-2", darkBg && "bg-white/10 border-white/20 text-white hover:bg-white/20")} onClick={goToday}>
            Hoje
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className={cn("flex rounded-md border overflow-hidden", border)}>
            <button
              onClick={() => setViewMode("month")}
              className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "month" ? (darkBg ? "bg-white/20 text-white" : "bg-primary text-primary-foreground") : (darkBg ? "text-white/60 hover:bg-white/10" : "text-muted-foreground hover:bg-muted"))}
            >
              Mês
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "week" ? (darkBg ? "bg-white/20 text-white" : "bg-primary text-primary-foreground") : (darkBg ? "text-white/60 hover:bg-white/10" : "text-muted-foreground hover:bg-muted"))}
            >
              Semana
            </button>
          </div>

          {/* Section filter */}
          <Select value={filterSecao} onValueChange={setFilterSecao}>
            <SelectTrigger className={cn("h-8 w-[140px] text-xs", darkBg && "bg-white/10 border-white/20 text-white")}>
              <SelectValue placeholder="Seção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas seções</SelectItem>
              {secoes.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className={cn("h-8 w-[140px] text-xs", darkBg && "bg-white/10 border-white/20 text-white")}>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pendente">Não iniciado</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluído</SelectItem>
              <SelectItem value="bloqueada">Bloqueada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar grid */}
      <div className={cn("border rounded-lg overflow-hidden", border)}>
        {/* Weekday headers */}
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div key={d} className={cn("text-center text-xs font-semibold py-2 border-b", border, darkBg ? "bg-white/5 text-white/70" : "bg-muted/50 text-muted-foreground")}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = getDateKey(day);
            const dayTasks = tasksByDate[key] || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const today = isDateToday(day);

            return (
              <div
                key={i}
                className={cn(
                  "border-b border-r min-h-[100px] p-1.5 transition-colors",
                  border,
                  today ? cellBgToday : isCurrentMonth ? cellBg : cellBgOutside,
                  viewMode === "week" && "min-h-[200px]",
                )}
              >
                {/* Day number */}
                <div className={cn("text-right mb-1")}>
                  <span className={cn(
                    "inline-flex items-center justify-center text-xs font-medium w-6 h-6 rounded-full",
                    today ? "bg-primary text-primary-foreground" : isCurrentMonth ? txt : txtMuted
                  )}>
                    {format(day, "d")}
                  </span>
                </div>

                {/* Task pills */}
                <div className="space-y-0.5">
                  {dayTasks.slice(0, maxVisible).map((t) => (
                    <TaskPill key={t.id} tarefa={t} darkBg={darkBg} onClick={() => setSelectedTarefaId(t.id)} />
                  ))}
                  {dayTasks.length > maxVisible && (
                    <OverflowPopover tasks={dayTasks.slice(maxVisible)} count={dayTasks.length - maxVisible} darkBg={darkBg} onClickTask={setSelectedTarefaId} />
                  )}
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
  const statusEntry = STATUS_ICONS[tarefa.status] || STATUS_ICONS.pendente;
  const StatusIcon = statusEntry.icon;
  const isCompleted = tarefa.status === "concluida";

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
      <StatusIcon className={cn("h-3 w-3 shrink-0", statusEntry.className)} />
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

  const statusEntry = STATUS_ICONS[tarefa.status] || STATUS_ICONS.pendente;
  const StatusIcon = statusEntry.icon;
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
          <StatusIcon className={cn("h-4 w-4", statusEntry.className)} />
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
