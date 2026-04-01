import { useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Clock, Circle, CheckCircle2, GripVertical } from "lucide-react";
import { format, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

function DroppableColumn({ id, children, isOver }: { id: string; children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 rounded-lg transition-all duration-200 min-h-[80px] ${
        isOver ? "bg-primary/5 ring-2 ring-primary/20 scale-[1.01]" : ""
      }`}
    >
      {children}
    </div>
  );
}

function DraggableCard({
  tarefa,
  onToggle,
  onSelect,
}: {
  tarefa: MinaTarefa;
  onToggle: (id: string, done: boolean) => void;
  onSelect: (t: MinaTarefa) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tarefa.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderLeftColor: tarefa.projeto_cor,
  };

  const isDone = tarefa.status === "concluida";
  const isOverdue = !isDone && tarefa.data_prazo && new Date(tarefa.data_prazo) < new Date();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`hover:shadow-md transition-all border-l-3 ${isDragging ? "shadow-xl z-50" : ""}`}
      onClick={() => onSelect(tarefa)}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Checkbox
            checked={isDone}
            onCheckedChange={(checked) => onToggle(tarefa.id, !!checked)}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 rounded-full h-4 w-4"
          />
          <span className={`text-sm flex-1 ${isDone ? "line-through text-muted-foreground" : ""}`}>
            {tarefa.titulo}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tarefa.projeto_cor }} />
            <span className="truncate max-w-[100px]">{tarefa.projeto_nome}</span>
          </div>
          {tarefa.data_prazo && (
            <span className={`ml-auto ${isOverdue ? "text-destructive font-medium" : ""}`}>
              {format(new Date(tarefa.data_prazo), "d MMM", { locale: ptBR })}
            </span>
          )}
        </div>
        {tarefa.prioridade && tarefa.prioridade !== "media" && (
          <Badge variant={tarefa.prioridade === "alta" || tarefa.prioridade === "urgente" ? "destructive" : "secondary"} className="text-[10px] h-4">
            {tarefa.prioridade === "alta" ? "Alta" : tarefa.prioridade === "urgente" ? "Urgente" : "Baixa"}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

function OverlayCard({ tarefa }: { tarefa: MinaTarefa }) {
  const isDone = tarefa.status === "concluida";
  return (
    <Card
      className="shadow-2xl border-l-3 rotate-[2deg] scale-105 w-[260px]"
      style={{ borderLeftColor: tarefa.projeto_cor }}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 mt-1 text-muted-foreground" />
          <Checkbox checked={isDone} className="mt-0.5 rounded-full h-4 w-4" disabled />
          <span className={`text-sm flex-1 ${isDone ? "line-through text-muted-foreground" : ""}`}>
            {tarefa.titulo}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tarefa.projeto_cor }} />
          <span className="truncate max-w-[100px]">{tarefa.projeto_nome}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function MinhasTarefasBoard({ tarefas, onToggle, onSelect }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

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

  const activeTarefa = useMemo(
    () => (activeId ? tarefas.find((t) => t.id === activeId) : null),
    [activeId, tarefas]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    if (overId && COLUMNS.some((c) => c.key === overId)) {
      setOverColumnId(overId);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setOverColumnId(null);

      const overId = event.over?.id as string | null;
      if (!overId || !event.active.id) return;

      // Find which column was dropped on
      const targetColumn = COLUMNS.find((c) => c.key === overId);
      if (!targetColumn) return;

      const taskId = event.active.id as string;
      const task = tarefas.find((t) => t.id === taskId);
      if (!task) return;

      // Determine current column
      const currentColumn = task.status === "concluida" ? "done" : (() => {
        if (!task.data_prazo) return "upcoming";
        const d = startOfDay(new Date(task.data_prazo));
        const now = startOfDay(new Date());
        if (d < now) return "overdue";
        if (isToday(d)) return "today";
        return "upcoming";
      })();

      if (currentColumn === targetColumn.key) return;

      // Execute the action
      if (targetColumn.key === "done") {
        onToggle(taskId, true);
      } else if (currentColumn === "done") {
        onToggle(taskId, false);
      }
    },
    [onToggle, tarefas]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumnId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div key={col.key} className="flex-1 min-w-[260px]">
            <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-md bg-muted/40 border border-border/30">
              {col.icon}
              <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>{col.title}</span>
              <Badge variant="secondary" className="text-[10px] ml-auto h-4 px-1.5">{groups[col.key].length}</Badge>
            </div>

            <DroppableColumn id={col.key} isOver={overColumnId === col.key}>
              {groups[col.key].map((t) => (
                <DraggableCard key={t.id} tarefa={t} onToggle={onToggle} onSelect={onSelect} />
              ))}
              {groups[col.key].length === 0 && (
                <div className={`text-center py-12 text-muted-foreground text-xs border-2 border-dashed rounded-lg transition-all ${
                  overColumnId === col.key ? "border-primary/40 bg-primary/5 text-primary" : "border-border/30"
                }`}>
                  {overColumnId === col.key ? "Solte aqui ↓" : "Nenhuma tarefa"}
                </div>
              )}
            </DroppableColumn>
          </div>
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeTarefa ? <OverlayCard tarefa={activeTarefa} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
