import { useState } from "react";
import { Loader2, Send, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useModulosDespachoResolved, type ModuloDespachoResolved } from "@/hooks/useModulosDespacho";

// Re-export for backward compatibility — now dynamic from DB
export function useDespachoModulos(): ModuloDespachoResolved[] {
  return useModulosDespachoResolved();
}

// Legacy constant kept as fallback — consumers should migrate to useDespachoModulos()
export const DESPACHO_MODULOS_PROCESSO: readonly { key: string; label: string; icon: LucideIcon; color: string }[] = [];

interface DespachoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentoTitulo: string;
  isPending?: boolean;
  onDespachar: (modulo: string, descricao: string) => Promise<void>;
}

export function DespachoDialog({ open, onOpenChange, documentoTitulo, isPending, onDespachar }: DespachoDialogProps) {
  const modulos = useModulosDespachoResolved();
  const [modulo, setModulo] = useState<string>("");
  const [descricao, setDescricao] = useState("");

  // Set default when modulos load
  if (!modulo && modulos.length > 0) {
    setModulo(modulos[0].key);
  }

  const handleDespachar = async () => {
    await onDespachar(modulo, descricao);
    onOpenChange(false);
    setDescricao("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Despachar para Módulo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{documentoTitulo}</span>
          </div>
          <div>
            <Label className="text-xs font-medium">Módulo de destino</Label>
            <RadioGroup value={modulo} onValueChange={setModulo} className="mt-2 space-y-2">
              {modulos.map((m) => {
                const ModIcon = m.icon;
                return (
                  <div key={m.key} className="flex items-center gap-2">
                    <RadioGroupItem value={m.key} id={`desp-proc-${m.key}`} />
                    <Label htmlFor={`desp-proc-${m.key}`} className="text-sm cursor-pointer flex items-center gap-2">
                      <ModIcon className={`h-4 w-4 ${m.color}`} /> {m.label}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
          <div>
            <Label className="text-xs">Descrição do despacho</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o que deve ser analisado..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleDespachar} disabled={isPending} className="gap-1.5">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Despachar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
