import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const DESPACHO_MODULOS_PROCESSO = [
  { key: "composicao", label: "Composição INCI", icon: "🧪" },
  { key: "regulatorio", label: "Regulatório", icon: "🛡️" },
  { key: "qualidade", label: "Qualidade", icon: "✅" },
  { key: "fluxo_artes", label: "Motor de Artes", icon: "🎨" },
  { key: "embalagem", label: "Embalagem", icon: "📦" },
  { key: "etiqueta_bula", label: "Etiqueta / Bula", icon: "🏷️" },
  { key: "cadastro", label: "Cadastro", icon: "📋" },
  { key: "logistica", label: "Logística", icon: "🚛" },
] as const;

interface DespachoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentoTitulo: string;
  isPending?: boolean;
  onDespachar: (modulo: string, descricao: string) => Promise<void>;
}

export function DespachoDialog({ open, onOpenChange, documentoTitulo, isPending, onDespachar }: DespachoDialogProps) {
  const [modulo, setModulo] = useState<string>(DESPACHO_MODULOS_PROCESSO[0].key);
  const [descricao, setDescricao] = useState("");

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
              {DESPACHO_MODULOS_PROCESSO.map((m) => (
                <div key={m.key} className="flex items-center gap-2">
                  <RadioGroupItem value={m.key} id={`desp-proc-${m.key}`} />
                  <Label htmlFor={`desp-proc-${m.key}`} className="text-sm cursor-pointer flex items-center gap-2">
                    <span>{m.icon}</span> {m.label}
                  </Label>
                </div>
              ))}
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
