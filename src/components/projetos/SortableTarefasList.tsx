import { memo, useMemo } from "react";
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
import { cn } from "@/lib/utils";
import type { ProjetoTarefa } from "@/hooks/useProjetoTarefas";

interface SortableRowProps {
  tarefa: ProjetoTarefa;
  darkBg?: boolean;
  children: React.ReactNode;
}

const SortableRow = memo(function SortableRow({ tarefa, darkBg, children, optimizeOffscreen }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarefa.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch group/dnd">
      <button
        type="button"
        className={cn(
          "flex items-center justify-center w-5 shrink-0 cursor-grab active:cursor-grabbing transition-opacity opacity-0 group-hover/dnd:opacity-100 focus-visible:opacity-100",
          darkBg ? "text-white/40 hover:text-white/80" : "text-muted-foreground/40 hover:text-muted-foreground",
        )}
        aria-label={`Reordenar tarefa ${tarefa.titulo}`}
        title="Arrastar para reordenar"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
});

interface SortableTarefasListProps {
  tarefas: ProjetoTarefa[];
  darkBg?: boolean;
  onReorder: (orderedIds: string[]) => void;
  renderRow: (tarefa: ProjetoTarefa) => React.ReactNode;
}

/**
 * Lista de tarefas com reordenação manual (drag & drop) dentro da seção.
 *
 * Usada apenas no modo lista sem filtros/ordenação ativos — nesses casos a
 * ordem exibida não corresponde à coluna `ordem` persistida, então arrastar
 * levaria a um resultado enganoso.
 */
export function SortableTarefasList({
  tarefas,
  darkBg,
  onReorder,
  renderRow,
}: SortableTarefasListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => tarefas.map((t) => t.id), [tarefas]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {tarefas.map((t) => (
          <SortableRow key={(t as any).__clientKey || t.id} tarefa={t} darkBg={darkBg}>
            {renderRow(t)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

/**
 * Linha com a alça de arrastar visível porém desabilitada, usada quando a
 * reordenação está indisponível (filtro/ordenação ativos ou seção muito longa).
 * Mantém o recurso descoberto pelo usuário, explicando o motivo no hover.
 */
export function DisabledGripRow({
  darkBg,
  motivo,
  children,
}: {
  darkBg?: boolean;
  motivo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-stretch group/dnd">
      <span
        className={cn(
          "flex items-center justify-center w-5 shrink-0 cursor-not-allowed opacity-0 group-hover/dnd:opacity-60 transition-opacity",
          darkBg ? "text-white/30" : "text-muted-foreground/40",
        )}
        aria-hidden="true"
        title={motivo}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
