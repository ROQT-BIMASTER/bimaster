import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, RotateCcw } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campoLabel: string;
  textoAnterior: string;
  novoTexto: string;
  racional?: string;
  mudancas?: { tipo: string; descricao: string }[];
  onUndo: () => void;
}

export function BriefingRetrabalhoDiffDialog({
  open, onOpenChange, campoLabel, textoAnterior, novoTexto, racional, mudancas, onUndo,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Campo retrabalhado pela IA · {campoLabel}
          </DialogTitle>
          {racional && (
            <DialogDescription className="text-xs">{racional}</DialogDescription>
          )}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Antes</div>
            <div className="rounded-md border border-border bg-muted/40 p-2 text-xs whitespace-pre-wrap max-h-[280px] overflow-y-auto">
              {textoAnterior || "(vazio)"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-emerald-600">Depois</div>
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs whitespace-pre-wrap max-h-[280px] overflow-y-auto">
              {novoTexto}
            </div>
          </div>
        </div>

        {mudancas && mudancas.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Mudanças</div>
            <ul className="text-xs space-y-0.5 list-disc pl-4">
              {mudancas.map((m, i) => (
                <li key={i}><span className="font-medium capitalize">{m.tipo}:</span> {m.descricao}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => { onUndo(); onOpenChange(false); }}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Desfazer
          </Button>
          <Button onClick={() => onOpenChange(false)}>Manter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
