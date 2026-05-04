import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  useMoverItemColuna,
  type ColunaUniversal,
  type KanbanItem,
} from "@/hooks/useKanbanAprovacoes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: KanbanItem | null;
  destino: ColunaUniversal | null;
}

const LABELS: Record<ColunaUniversal, { titulo: string; verbo: string; placeholder: string; required: boolean }> = {
  aprovado: {
    titulo: "Aprovar documento",
    verbo: "Aprovar",
    placeholder: "Comentário (opcional)",
    required: false,
  },
  rejeitado: {
    titulo: "Rejeitar documento",
    verbo: "Rejeitar",
    placeholder: "Justifique a rejeição",
    required: true,
  },
  em_revisao: {
    titulo: "Devolver para revisão",
    verbo: "Devolver",
    placeholder: "O que precisa ser ajustado?",
    required: true,
  },
  em_analise: { titulo: "", verbo: "", placeholder: "", required: false },
  aguardando_outros: { titulo: "", verbo: "", placeholder: "", required: false },
};

export function MoverColunaDialog({ open, onOpenChange, item, destino }: Props) {
  const [comentario, setComentario] = useState("");
  const mover = useMoverItemColuna();

  useEffect(() => {
    if (!open) setComentario("");
  }, [open]);

  if (!item || !destino) return null;
  const cfg = LABELS[destino];
  if (!cfg.titulo) return null;

  async function confirmar() {
    if (!item || !destino) return;
    if (cfg.required && !comentario.trim()) return;
    await mover.mutateAsync({
      itemId: item.id,
      coluna: destino,
      comentario: comentario.trim() || undefined,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{cfg.titulo}</DialogTitle>
          <DialogDescription className="text-xs">
            {item.documento_nome || item.documento_tipo || "Documento"}
            {item.pipeline_nome && ` · ${item.pipeline_nome}`}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder={cfg.placeholder}
          className="text-xs min-h-[80px]"
          autoFocus
        />
        {cfg.required && !comentario.trim() && (
          <p className="text-[10px] text-muted-foreground">Comentário obrigatório.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={mover.isPending || (cfg.required && !comentario.trim())}
            variant={destino === "rejeitado" ? "destructive" : "default"}
          >
            {mover.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {cfg.verbo}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
