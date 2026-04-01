import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday,
  isSameDay, startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface Props {
  tarefas: MinaTarefa[];
  onSelect: (t: MinaTarefa) => void;
}

export function MinhasTarefasCalendar({ tarefas, onSelect }: Props) {
  const [current, setCurrent] = useState(new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [current]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, MinaTarefa[]>();
    for (const t of tarefas) {
      if (!t.data_prazo) continue;
      const key = format(startOfDay(new Date(t.data_prazo)), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [tarefas]);

  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <div className="space-y-3">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setCurrent(subMonths(current, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold capitalize">
          {format(current, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrent(addMonths(current, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week header */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(d => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) || [];
          const inMonth = isSameMonth(day, current);
          const today = isToday(day);
          const hasOverdue = dayTasks.some(t => t.status !== "concluida" && new Date(t.data_prazo!) < new Date());

          return (
            <Popover key={key}>
              <PopoverTrigger asChild>
                <button
                  className={`
                    min-h-[80px] lg:min-h-[100px] p-1.5 rounded-lg border text-left transition-all
                    ${today ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/30 hover:border-border"}
                    ${!inMonth ? "opacity-40" : ""}
                    ${dayTasks.length > 0 ? "cursor-pointer hover:shadow-sm" : ""}
                  `}
                >
                  <div className={`text-xs font-medium mb-1 ${today ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </div>

                  {/* Task dots / previews */}
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
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {dayTasks.map(t => (
                      <button
                        key={t.id}
                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors flex items-center gap-2"
                        onClick={() => onSelect(t)}
                      >
                        {t.status === "concluida" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs truncate ${t.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>
                            {t.titulo}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.projeto_cor }} />
                            <span className="text-[10px] text-muted-foreground truncate">{t.projeto_nome}</span>
                          </div>
                        </div>
                        {t.prioridade === "urgente" && <Badge variant="destructive" className="text-[9px] h-3.5 px-1">!</Badge>}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              )}
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
