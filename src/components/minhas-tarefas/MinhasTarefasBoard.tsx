import { useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Clock, Circle, CheckCircle2 } from "lucide-react";
import { format, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface Props {
  tarefas: MinaTarefa[];
  onToggle: (id: string, done: boolean) => void;
  onSelect: (t: MinaTarefa) => void;
}

type ColumnKey = "overdue" | "today" | "upcoming" | "done";

const COLUMNS: { key: ColumnKey; title: string; icon: React.ReactNode; color: string }[] = [
  { key: "overdue", title: "Atrasadas", icon: <AlertTriangle className="h-4 w-4 text-destructive" />, color: "text-destructive" },
  { key: "today", title: "Hoje", icon: <Clock className="h-4 w-4 text-primary" />, color: "text-primary" },
  { key: "upcoming", title: "A fazer", icon: <Circle className="h-4 w-4 text-muted-foreground" />, color: "text-foreground" },
  { key: "done", title: "Concluídas", icon: <CheckCircle2 className="h-4 w-4 text-success" />, color: "text-success" },
];

export function MinhasTarefasBoard({ tarefas, onToggle, onSelect }: Props) {
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  const groups = useMemo(() => {
    const now = startOfDay(new Date());
    const result: Record<ColumnKey, MinaTarefa[]> = { overdue: [], today: [], upcoming: [], done: [] };

    for (const t of tarefas) {
      if (t.status === "concluida") { result.done.push(t); continue; }
      if (!t.data_prazo) { result.upcoming.push(t); continue; }
      const d = startOfDay(new Date(t.data_prazo));
      if (d < now) result.overdue.push(t);
      else if (isToday(d)) result.today.push(t);
      else result.upcoming.push(t);
    }
    result.done = result.done.slice(0, 10);
    return result;
  }, [tarefas]);

  const handleDragStart = useCallback((e: React.DragEvent, tarefa: MinaTarefa) => {
    e.dataTransfer.setData("text/plain", tarefa.id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, column: ColumnKey) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    if (column === "done") {
      onToggle(taskId, true);
    } else {
      // Reopen if was completed
      const task = tarefas.find(t => t.id === taskId);
      if (task?.status === "concluida") {
        onToggle(taskId, false);
      }
    }
  }, [onToggle, tarefas]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map(col => (
        <div
          key={col.key}
          className="flex-1 min-w-[260px]"
          onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.key); }}
          onDragLeave={() => setDragOverColumn(null)}
          onDrop={(e) => handleDrop(e, col.key)}
        >
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-md bg-muted/40 border border-border/30">
            {col.icon}
            <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>{col.title}</span>
            <Badge variant="secondary" className="text-[10px] ml-auto h-4 px-1.5">{groups[col.key].length}</Badge>
          </div>

          <div className={`space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 rounded-lg transition-colors ${dragOverColumn === col.key ? "bg-primary/5 ring-2 ring-primary/20" : ""}`}>
            {groups[col.key].map(t => (
              <Card
                key={t.id}
                draggable
                onDragStart={(e) => handleDragStart(e, t)}
                className="hover:shadow-md transition-all cursor-grab active:cursor-grabbing border-l-3 active:shadow-lg active:scale-[1.02]"
                style={{ borderLeftColor: t.projeto_cor }}
                onClick={() => onSelect(t)}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={t.status === "concluida"}
                      onCheckedChange={(checked) => onToggle(t.id, !!checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 rounded-full h-4 w-4"
                    />
                    <span className={`text-sm flex-1 ${t.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>
                      {t.titulo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: t.projeto_cor }} />
                      <span className="truncate max-w-[100px]">{t.projeto_nome}</span>
                    </div>
                    {t.data_prazo && (
                      <span className={`ml-auto ${!t.data_conclusao && new Date(t.data_prazo) < new Date() ? "text-destructive font-medium" : ""}`}>
                        {format(new Date(t.data_prazo), "d MMM", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  {t.prioridade && t.prioridade !== "media" && (
                    <Badge variant={t.prioridade === "alta" || t.prioridade === "urgente" ? "destructive" : "secondary"} className="text-[10px] h-4">
                      {t.prioridade === "alta" ? "Alta" : t.prioridade === "urgente" ? "Urgente" : "Baixa"}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
            {groups[col.key].length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-xs border-2 border-dashed border-border/30 rounded-lg">
                {dragOverColumn === col.key ? "Solte aqui" : "Nenhuma tarefa"}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
