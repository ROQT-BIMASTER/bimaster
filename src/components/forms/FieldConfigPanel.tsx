import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { FormField } from "./FormFieldCard";

interface FieldConfigPanelProps {
  field: FormField;
  onUpdate: (id: string, updates: Partial<FormField>) => void;
  onClose: () => void;
}

export function FieldConfigPanel({ field, onUpdate, onClose }: FieldConfigPanelProps) {
  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Configuração: {field.label || "Campo"}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Placeholder</Label>
          <Input
            value={field.placeholder || ""}
            onChange={(e) => onUpdate(field.id, { placeholder: e.target.value })}
            placeholder="Texto de ajuda"
          />
        </div>

        {(field.field_type === "text" || field.field_type === "number") && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Mín</Label>
                <Input
                  type="number"
                  value={field.validation?.min ?? ""}
                  onChange={(e) =>
                    onUpdate(field.id, {
                      validation: { ...field.validation, min: e.target.value ? Number(e.target.value) : undefined },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Máx</Label>
                <Input
                  type="number"
                  value={field.validation?.max ?? ""}
                  onChange={(e) =>
                    onUpdate(field.id, {
                      validation: { ...field.validation, max: e.target.value ? Number(e.target.value) : undefined },
                    })
                  }
                />
              </div>
            </div>
          </>
        )}

        {field.field_type === "text" && (
          <div>
            <Label className="text-xs">Padrão (regex)</Label>
            <Input
              value={field.validation?.pattern ?? ""}
              onChange={(e) =>
                onUpdate(field.id, {
                  validation: { ...field.validation, pattern: e.target.value || undefined },
                })
              }
              placeholder="Ex: ^\d{3}\.\d{3}\.\d{3}-\d{2}$"
            />
          </div>
        )}
      </div>
    </div>
  );
}
