import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CheckCircle2, Calendar as CalendarIcon, AlertTriangle } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday,
  isSameDay, startOfDay, getDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface Props {
  tarefas: MinaTarefa[];
  onSelect: (t: MinaTarefa) => void;
  onComplete?: (t: MinaTarefa) => void;
}

export function MinhasTarefasCalendar({ tarefas, onSelect, onComplete }: Props) {
  const [current, setCurrent] = useState(new Date());
  const [filterProjeto, setFilterProjeto] = useState<string | null>(null);

  const days = useMemo(() => {
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [current]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, MinaTarefa[]>();
    const filtered = filterProjeto ? tarefas.filter(t => t.projeto_id === filterProjeto) : tarefas;
    for (const t of filtered) {
      if (!t.data_prazo) continue;
      const key = format(startOfDay(new Date(t.data_prazo)), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tarefas, filterProjeto]);

  // Monthly stats
  const monthStats = useMemo(() => {
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);
    const filtered = filterProjeto ? tarefas.filter(t => t.projeto_id === filterProjeto) : tarefas;
    const inMonth = filtered.filter(t => {
      if (!t.data_prazo) return false;
      const d = new Date(t.data_prazo);
      return d >= monthStart && d <= monthEnd;
    });
    const concluidas = inMonth.filter(t => t.status === "concluida").length;
    const atrasadas = inMonth.filter(t => t.status !== "concluida" && t.data_prazo && new Date(t.data_prazo) < new Date()).length;
    return { total: inMonth.length, concluidas, atrasadas, pendentes: inMonth.length - concluidas };
  }, [tarefas, current, filterProjeto]);

  // Unique projects in month for legend
  const projectsInMonth = useMemo(() => {
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);
    const map = new Map<string, { id: string; nome: string; cor: string }>();
    for (const t of tarefas) {
      if (!t.data_prazo) continue;
      const d = new Date(t.data_prazo);
      if (d >= monthStart && d <= monthEnd && !map.has(t.projeto_id)) {
        map.set(t.projeto_id, { id: t.projeto_id, nome: t.projeto_nome, cor: t.projeto_cor });
      }
    }
    return Array.from(map.values());
  }, [tarefas, current]);

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const isCurrentMonth = isSameMonth(current, new Date());

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrent(subMonths(current, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrent(new Date())}>
              Hoje
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrent(addMonths(current, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h3 className="text-base font-semibold capitalize">
          {format(current, "MMMM yyyy", { locale: ptBR })}
        </h3>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {monthStats.total > 0 && (
            <>
              <span>{monthStats.total} tarefa{monthStats.total !== 1 ? "s" : ""}</span>
              {monthStats.atrasadas > 0 && (
                <span className="text-destructive font-medium">· {monthStats.atrasadas} atrasada{monthStats.atrasadas !== 1 ? "s" : ""}</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Project legend */}
      {projectsInMonth.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterProjeto && (
            <button
              onClick={() => setFilterProjeto(null)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Todos
            </button>
          )}
          {projectsInMonth.map(p => (
            <button
              key={p.id}
              onClick={() => setFilterProjeto(filterProjeto === p.id ? null : p.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 transition-all ${
                filterProjeto === p.id ? "ring-1 ring-primary shadow-sm" : "hover:opacity-80"
              }`}
              style={{ backgroundColor: p.cor + "20", color: p.cor }}
            >
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.cor }} />
              {p.nome}
            </button>
          ))}
        </div>
      )}

      {/* Week header */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d, i) => (
          <div
            key={d}
            className={`text-center text-xs font-medium py-1.5 rounded-md ${
              i >= 5 ? "text-muted-foreground/60" : "text-muted-foreground"
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) || [];
          const inMonth = isSameMonth(day, current);
          const today = isToday(day);
          const dayOfWeek = getDay(day);
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const pendingTasks = dayTasks.filter(t => t.status !== "concluida");
          const doneTasks = dayTasks.filter(t => t.status === "concluida");
          const hasOverdue = pendingTasks.some(t => t.data_prazo && new Date(t.data_prazo) < new Date());

          return (
            <Popover key={key}>
              <PopoverTrigger asChild>
                <button
                  className={`
                    relative min-h-[85px] lg:min-h-[105px] p-1.5 rounded-lg border text-left transition-all
                    hover:shadow-sm hover:scale-[1.01]
                    ${today ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/30 hover:border-border"}
                    ${!inMonth ? "opacity-30" : ""}
                    ${isWeekend && inMonth ? "bg-muted/15" : ""}
                    ${dayTasks.length > 0 ? "cursor-pointer" : ""}
                  `}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1">
                    <div
                      className={`text-xs font-medium h-6 w-6 flex items-center justify-center rounded-full ${
                        today
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                    {dayTasks.length > 0 && (
                      <span className="text-[9px] text-muted-foreground/60">{dayTasks.length}</span>
                    )}
                  </div>

                  {/* Task previews */}
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map(t => (
                      <div
                        key={t.id}
                        className="text-[10px] leading-tight px-1 py-0.5 rounded truncate flex items-center gap-1"
                        style={{ backgroundColor: t.projeto_cor + "20" }}
                      >
                        <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: t.projeto_cor }} />
                        <span className={`truncate ${t.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>
                          {t.titulo}
                        </span>
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{dayTasks.length - 3} mais</div>
                    )}
                  </div>

                  {/* Overdue indicator */}
                  {hasOverdue && (
                    <div className="absolute top-1 right-1">
                      <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                    </div>
                  )}
                </button>
              </PopoverTrigger>

              {dayTasks.length > 0 && (
                <PopoverContent className="w-80 p-3" align="start">
                  <div className="text-xs font-semibold text-foreground mb-1">
                    {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </div>
                  <div className="text-[10px] text-muted-foreground mb-3">
                    {pendingTasks.length} pendente{pendingTasks.length !== 1 ? "s" : ""}
                    {doneTasks.length > 0 && ` · ${doneTasks.length} concluída${doneTasks.length !== 1 ? "s" : ""}`}
                  </div>

                  <div className="space-y-1 max-h-[250px] overflow-y-auto">
                    {/* Pending first */}
                    {pendingTasks.map(t => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors group"
                      >
                        {onComplete && (
                          <Checkbox
                            className="h-3.5 w-3.5 rounded-full"
                            onCheckedChange={() => onComplete(t)}
                          />
                        )}
                        <button
                          className="flex-1 min-w-0 text-left"
                          onClick={() => onSelect(t)}
                        >
                          <div className="text-xs truncate">{t.titulo}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.projeto_cor }} />
                            <span className="text-[10px] text-muted-foreground truncate">{t.projeto_nome}</span>
                          </div>
                        </button>
                        {t.prioridade === "urgente" && <Badge variant="destructive" className="text-[9px] h-4 px-1">!</Badge>}
                        {t.prioridade === "alta" && <Badge variant="warning" className="text-[9px] h-4 px-1">Alta</Badge>}
                      </div>
                    ))}

                    {/* Separator */}
                    {pendingTasks.length > 0 && doneTasks.length > 0 && (
                      <div className="border-t border-border/50 my-1" />
                    )}

                    {/* Done tasks */}
                    {doneTasks.map(t => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        <button
                          className="flex-1 min-w-0 text-left"
                          onClick={() => onSelect(t)}
                        >
                          <div className="text-xs truncate line-through text-muted-foreground">{t.titulo}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.projeto_cor }} />
                            <span className="text-[10px] text-muted-foreground truncate">{t.projeto_nome}</span>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          );
        })}
      </div>

      {/* Empty state */}
      {monthStats.total === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
          <CalendarIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma tarefa neste mês</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Crie tarefas com prazo para visualizá-las aqui</p>
        </div>
      )}

      {/* Monthly stats footer */}
      {monthStats.total > 0 && (
        <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground py-2 border-t border-border/30">
          <span>{monthStats.total} total</span>
          <span className="text-success">{monthStats.concluidas} concluída{monthStats.concluidas !== 1 ? "s" : ""}</span>
          {monthStats.atrasadas > 0 && (
            <span className="text-destructive flex items-center gap-0.5">
              <AlertTriangle className="h-3 w-3" />
              {monthStats.atrasadas} atrasada{monthStats.atrasadas !== 1 ? "s" : ""}
            </span>
          )}
          <span>{monthStats.pendentes} pendente{monthStats.pendentes !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}
