import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

        {(field.field_type === "file" || field.field_type === "image") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div>
                <Label className="text-xs font-medium">Permitir múltiplos arquivos</Label>
                <p className="text-[10px] text-muted-foreground">
                  {field.field_type === "image"
                    ? "Usuário poderá enviar várias imagens neste campo"
                    : "Usuário poderá anexar vários arquivos neste campo"}
                </p>
              </div>
              <Switch
                checked={!!field.validation?.multiple}
                onCheckedChange={(v) =>
                  onUpdate(field.id, {
                    validation: { ...field.validation, multiple: v || undefined },
                  })
                }
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Tam. máx (MB)</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={field.validation?.maxSizeMB ?? ""}
                  placeholder={field.field_type === "image" ? "10" : "20"}
                  onChange={(e) =>
                    onUpdate(field.id, {
                      validation: { ...field.validation, maxSizeMB: e.target.value ? Number(e.target.value) : undefined },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Qtd. máx</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  disabled={!field.validation?.multiple}
                  value={field.validation?.maxFiles ?? ""}
                  placeholder={field.validation?.multiple ? "10" : "1"}
                  onChange={(e) =>
                    onUpdate(field.id, {
                      validation: { ...field.validation, maxFiles: e.target.value ? Number(e.target.value) : undefined },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Total máx (MB)</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  disabled={!field.validation?.multiple}
                  value={field.validation?.maxTotalSizeMB ?? ""}
                  placeholder={field.field_type === "image" ? "30" : "50"}
                  onChange={(e) =>
                    onUpdate(field.id, {
                      validation: { ...field.validation, maxTotalSizeMB: e.target.value ? Number(e.target.value) : undefined },
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}

        {field.field_type === "banner" && (
          <div>
            <Label className="text-xs">Proporção do banner</Label>
            <Select
              value={field.validation?.aspect || "3:1"}
              onValueChange={(v) =>
                onUpdate(field.id, { validation: { ...field.validation, aspect: v } })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3:1">3:1 (Banner Trade)</SelectItem>
                <SelectItem value="16:9">16:9 (Widescreen)</SelectItem>
                <SelectItem value="4:3">4:3</SelectItem>
                <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                <SelectItem value="free">Livre (sem crop)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              O usuário verá uma área de recorte com essa proporção; "Livre" envia a imagem inteira.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
