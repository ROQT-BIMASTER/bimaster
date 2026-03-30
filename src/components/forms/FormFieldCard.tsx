import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, Trash2, Settings2 } from "lucide-react";

export interface FormField {
  id: string;
  label: string;
  field_type: string;
  required: boolean;
  options: string[];
  placeholder: string;
  validation: Record<string, any>;
  order_index: number;
}

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Seleção" },
  { value: "checkbox", label: "Checkbox" },
  { value: "file", label: "Arquivo" },
  { value: "image", label: "Imagem" },
  { value: "price", label: "Preço" },
  { value: "address", label: "Endereço (CEP)" },
];

interface FormFieldCardProps {
  field: FormField;
  onUpdate: (id: string, updates: Partial<FormField>) => void;
  onRemove: (id: string) => void;
  onOpenConfig: (id: string) => void;
}

export function FormFieldCard({ field, onUpdate, onRemove, onOpenConfig }: FormFieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="p-4 flex items-start gap-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-1 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            value={field.label}
            onChange={(e) => onUpdate(field.id, { label: e.target.value })}
            placeholder="Nome do campo"
            className="flex-1"
          />
          <Select
            value={field.field_type}
            onValueChange={(v) => onUpdate(field.id, { field_type: v })}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(field.field_type === "select" || field.field_type === "checkbox") && (
          <Input
            value={(field.options || []).join(", ")}
            onChange={(e) =>
              onUpdate(field.id, {
                options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
            placeholder="Opções separadas por vírgula"
            className="text-sm"
          />
        )}

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={field.required}
              onCheckedChange={(v) => onUpdate(field.id, { required: v })}
              id={`req-${field.id}`}
            />
            <Label htmlFor={`req-${field.id}`} className="text-xs text-muted-foreground">
              Obrigatório
            </Label>
          </div>
        </div>
      </div>

      <div className="flex gap-1 mt-1">
        <Button variant="ghost" size="icon" onClick={() => onOpenConfig(field.id)}>
          <Settings2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onRemove(field.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </Card>
  );
}
