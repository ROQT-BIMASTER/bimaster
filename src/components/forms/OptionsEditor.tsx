import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X, GripVertical } from "lucide-react";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface OptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
  fieldType: "select" | "checkbox";
}

interface OptionRowProps {
  id: string;
  index: number;
  total: number;
  value: string;
  onUpdate: (val: string) => void;
  onRemove: () => void;
  onMove: (from: number, to: number) => void;
}

function OptionRow({ id, index, total, value, onUpdate, onRemove, onMove }: OptionRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : "auto" as const,
  };

  function handleHandleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    // Alt+ArrowUp/Down moves the option without needing pointer drag
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const target = e.key === "ArrowUp" ? index - 1 : index + 1;
      if (target >= 0 && target < total) onMove(index, target);
    } else if (e.key === "Home" && e.altKey) {
      e.preventDefault();
      if (index !== 0) onMove(index, 0);
    } else if (e.key === "End" && e.altKey) {
      e.preventDefault();
      if (index !== total - 1) onMove(index, total - 1);
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 group bg-background rounded">
      <button
        type="button"
        {...attributes}
        {...listeners}
        onKeyDown={handleHandleKeyDown}
        aria-label={`Opção ${index + 1} de ${total}: ${value || "vazia"}. Use Alt+Setas para reordenar, ou arraste.`}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none rounded p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:text-foreground"
        title="Arraste ou use Alt+Setas para reordenar"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Input
        value={value}
        onChange={(e) => onUpdate(e.target.value)}
        className="h-8 text-sm flex-1"
        aria-label={`Texto da opção ${index + 1}`}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={onRemove}
        aria-label={`Remover opção ${index + 1}`}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function OptionsEditor({ options, onChange, fieldType }: OptionsEditorProps) {
  const [draft, setDraft] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Use option text as id; if duplicates exist (shouldn't), append index
  const ids = options.map((o, i) => `${o}__${i}`);

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (options.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...options, v]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(options.filter((_, i) => i !== idx));
  }

  function update(idx: number, val: string) {
    const next = [...options];
    next[idx] = val;
    onChange(next);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= options.length || from === to) return;
    onChange(arrayMove(options, from, to));
  }

  function bulkPaste(text: string) {
    const items = text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length <= 1) return false;
    const merged = [...options];
    for (const it of items) if (!merged.includes(it)) merged.push(it);
    onChange(merged);
    setDraft("");
    return true;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(options, oldIndex, newIndex));
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Opções da {fieldType === "select" ? "lista" : "caixa de seleção"}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {options.length} {options.length === 1 ? "opção" : "opções"}
        </Badge>
      </div>

      {options.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {options.map((opt, idx) => (
                <OptionRow
                  key={ids[idx]}
                  id={ids[idx]}
                  index={idx}
                  total={options.length}
                  value={opt}
                  onUpdate={(v) => update(idx, v)}
                  onRemove={() => remove(idx)}
                  onMove={move}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (bulkPaste(text)) e.preventDefault();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Digite uma opção e pressione Enter"
          className="h-8 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={add}
          disabled={!draft.trim()}
          className="h-8 gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Arraste pelo ícone à esquerda para reordenar. Cole várias opções separadas por vírgula, ponto-e-vírgula ou quebra de linha para adicionar de uma vez.
      </p>
    </div>
  );
}
