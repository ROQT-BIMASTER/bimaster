import { memo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface SortableRowProps {
  tarefa: MinaTarefa;
  children: React.ReactNode;
}

const SortableRow = memo(function SortableRow({ tarefa, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: tarefa.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch group/dnd">
      <button
        type="button"
        className="flex items-center justify-center w-6 shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors border-b border-border/20"
        aria-label={`Arrastar tarefa ${tarefa.titulo}`}
        title="Arrastar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
});

interface ManualPrioritySortableProps {
  items: MinaTarefa[];
  onReorder: (newOrderIds: string[]) => void;
  renderRow: (tarefa: MinaTarefa) => React.ReactNode;
}

/**
 * DnD list used exclusively in the "prioridade" sort mode of the Central de
 * Trabalho. Lets the user drag rows to override the automatic priority order.
 * The new order is reported as an array of IDs to be persisted by the parent.
 */
export function ManualPrioritySortable({
  items,
  onReorder,
  renderRow,
}: ManualPrioritySortableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(items, oldIndex, newIndex);
    onReorder(next.map((it) => it.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
        {items.map((t) => (
          <SortableRow key={t.id} tarefa={t}>
            {renderRow(t)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}
