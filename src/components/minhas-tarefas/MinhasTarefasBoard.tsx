import { useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Clock, Circle, CheckCircle2, GripVertical } from "lucide-react";
import { format, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";
import { TarefaResponsavelAvatar } from "@/components/projetos/shared/TarefaResponsavelAvatar";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

interface Props {
  tarefas: MinaTarefa[];
  onToggle: (id: string, done: boolean) => void;
  onSelect: (t: MinaTarefa) => void;
  onChangePrazo?: (id: string, novaData: string | null) => void;
}

type ColumnKey = "overdue" | "today" | "upcoming" | "done";

const COLUMNS: { key: ColumnKey; title: string; icon: React.ReactNode; color: string }[] = [
  { key: "overdue", title: "Atrasadas", icon: <AlertTriangle className="h-4 w-4 text-destructive" />, color: "text-destructive" },
  { key: "today", title: "Hoje", icon: <Clock className="h-4 w-4 text-primary" />, color: "text-primary" },
  { key: "upcoming", title: "A fazer", icon: <Circle className="h-4 w-4 text-muted-foreground" />, color: "text-foreground" },
  { key: "done", title: "Concluídas", icon: <CheckCircle2 className="h-4 w-4 text-success" />, color: "text-success" },
];

function toIsoDate(d: Date): string {
  // YYYY-MM-DD em horário local
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function tarefaColumn(t: MinaTarefa): ColumnKey {
  if (t.status === "concluida") return "done";
  const prazo = parseLocalDate(t.data_prazo);
  if (!prazo) return "upcoming";
  const d = startOfDay(prazo);
  const now = startOfDay(new Date());
  if (d < now) return "overdue";
  if (isToday(d)) return "today";
  return "upcoming";
}

function DroppableColumn({ id, children, isOver }: { id: string; children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1 rounded-lg transition-all duration-200 min-h-[120px] p-1 ${
        isOver ? "bg-primary/5 ring-2 ring-primary/20" : ""
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tarefa.id,
    data: { tarefa },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    borderLeftColor: tarefa.projeto_cor,
  };

  const isDone = tarefa.status === "concluida";
  const prazo = parseLocalDate(tarefa.data_prazo);
  const isOverdue = !isDone && prazo && prazo < startOfDay(new Date());

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`hover:shadow-md transition-all border-l-3 touch-none cursor-grab active:cursor-grabbing ${
        isDragging ? "shadow-xl z-50" : ""
      }`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
          <Checkbox
            checked={isDone}
            onCheckedChange={(checked) => onToggle(tarefa.id, !!checked)}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 rounded-full h-4 w-4"
          />
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(tarefa);
            }}
            className={`text-sm flex-1 text-left ${isDone ? "line-through text-muted-foreground" : ""}`}
          >
            {tarefa.titulo}
          </button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tarefa.projeto_cor }} />
            <span className="truncate max-w-[100px]">{tarefa.projeto_nome}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <TarefaResponsavelAvatar
              responsavelId={tarefa.responsavel_id}
              nome={tarefa.responsavel_nome}
              avatarUrl={tarefa.responsavel_avatar_url}
              size="xs"
            />
            {prazo && (
              <span className={isOverdue ? "text-destructive font-medium" : ""}>
                {format(prazo, "d MMM", { locale: ptBR })}
              </span>
            )}
          </div>
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
      </CardContent>
    </Card>
  );
}

export function MinhasTarefasBoard({ tarefas, onToggle, onSelect, onChangePrazo }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<ColumnKey | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // Prioriza droppable da coluna sob o cursor; fallback para intersecção de retângulos.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) {
      const col = pointer.find((c) => COLUMNS.some((k) => k.key === c.id));
      if (col) return [col];
      return pointer;
    }
    const rect = rectIntersection(args);
    const col = rect.find((c) => COLUMNS.some((k) => k.key === c.id));
    return col ? [col] : rect;
  }, []);

  const groups = useMemo(() => {
    const result: Record<ColumnKey, MinaTarefa[]> = { overdue: [], today: [], upcoming: [], done: [] };
    for (const t of tarefas) {
      result[tarefaColumn(t)].push(t);
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
    const overId = event.over?.id as string | undefined;
    if (!overId) {
      setOverColumnId(null);
      return;
    }
    if (COLUMNS.some((c) => c.key === overId)) {
      setOverColumnId(overId as ColumnKey);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setOverColumnId(null);

      const overId = event.over?.id as string | undefined;
      if (!overId) return;
      const targetKey = COLUMNS.find((c) => c.key === overId)?.key;
      if (!targetKey) return;

      const taskId = event.active.id as string;
      const task = tarefas.find((t) => t.id === taskId);
      if (!task) return;

      const currentColumn = tarefaColumn(task);
      if (currentColumn === targetKey) return;

      if (targetKey === "done") {
        onToggle(taskId, true);
        return;
      }
      if (currentColumn === "done") {
        onToggle(taskId, false);
        // segue ajustando data abaixo, se aplicável
      }

      if (!onChangePrazo) return;

      const today = startOfDay(new Date());
      if (targetKey === "today") {
        onChangePrazo(taskId, toIsoDate(today));
      } else if (targetKey === "overdue") {
        const ontem = new Date(today);
        ontem.setDate(ontem.getDate() - 1);
        onChangePrazo(taskId, toIsoDate(ontem));
      } else if (targetKey === "upcoming") {
        const prazo = parseLocalDate(task.data_prazo);
        if (!prazo || prazo <= today) {
          const amanha = new Date(today);
          amanha.setDate(amanha.getDate() + 1);
          onChangePrazo(taskId, toIsoDate(amanha));
        }
      }
    },
    [onToggle, onChangePrazo, tarefas]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumnId(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
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
                  {overColumnId === col.key ? "Solte aqui" : "Nenhuma tarefa"}
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
