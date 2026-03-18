import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DESPACHO_MODULOS, useDespacharModulo } from "@/hooks/useChinaPastaDigital";

interface DespachoModuloDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  submissaoId: string;
  itemTitulo: string;
}

export function DespachoModuloDialog({ open, onOpenChange, itemId, submissaoId, itemTitulo }: DespachoModuloDialogProps) {
  const [modulo, setModulo] = useState<string>(DESPACHO_MODULOS[0].key);
  const [descricao, setDescricao] = useState("");
  const despachar = useDespacharModulo();

  const handleDespachar = async () => {
    await despachar.mutateAsync({
      id: itemId,
      submissao_id: submissaoId,
      despacho_modulo: modulo,
      despacho_descricao: descricao || undefined,
    });
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
            <span className="font-medium text-foreground">{itemTitulo}</span>
          </div>
          <div>
            <Label className="text-xs font-medium">Módulo de destino</Label>
            <RadioGroup value={modulo} onValueChange={setModulo} className="mt-2 space-y-2">
              {DESPACHO_MODULOS.map((m) => (
                <div key={m.key} className="flex items-center gap-2">
                  <RadioGroupItem value={m.key} id={`desp-${m.key}`} />
                  <Label htmlFor={`desp-${m.key}`} className="text-sm cursor-pointer flex items-center gap-2">
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
          <Button onClick={handleDespachar} disabled={despachar.isPending} className="gap-1.5">
            {despachar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Despachar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
