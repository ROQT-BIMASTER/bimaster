import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";
import { useSuporteAcoes } from "@/hooks/suporte/useSuporteAcoes";
import {
  SUPORTE_PRIORIDADE_LABEL,
  type SuportePrioridade,
} from "@/hooks/suporte/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  prioridadeAtual: SuportePrioridade;
  onEscalonado?: () => void;
}

const PRIORIDADE_RANK: Record<SuportePrioridade, number> = {
  baixa: 0,
  media: 1,
  alta: 2,
  critica: 3,
};

export function EscalonarChamadoDialog({
  open,
  onOpenChange,
  ticketId,
  prioridadeAtual,
  onEscalonado,
}: Props) {
  const { escalonar } = useSuporteAcoes();
  const [motivo, setMotivo] = useState("");
  const [novaPrioridade, setNovaPrioridade] = useState<SuportePrioridade>(
    prioridadeAtual === "critica" ? "critica" : "alta",
  );

  const motivoValido = motivo.trim().length >= 10;
  const podeConfirmar = motivoValido && !escalonar.isPending;
  // Opções de prioridade: só permite escolher igual ou acima da atual.
  const opcoesPrioridade = (
    ["baixa", "media", "alta", "critica"] as SuportePrioridade[]
  ).filter((p) => PRIORIDADE_RANK[p] >= PRIORIDADE_RANK[prioridadeAtual]);

  const handleClose = (v: boolean) => {
    if (escalonar.isPending) return;
    if (!v) {
      setMotivo("");
      setNovaPrioridade(prioridadeAtual === "critica" ? "critica" : "alta");
    }
    onOpenChange(v);
  };

  const handleConfirm = async () => {
    try {
      await escalonar.mutateAsync({
        ticketId,
        motivo: motivo.trim(),
        novaPrioridade,
      });
      handleClose(false);
      onEscalonado?.();
    } catch {
      /* toast tratado no hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Escalonar chamado
          </DialogTitle>
          <DialogDescription>
            Marca o chamado como "Escalado", ajusta a prioridade e publica uma nota
            interna no chat com o motivo (invisível ao solicitante).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="prioridade-esc">Prioridade</Label>
            <Select
              value={novaPrioridade}
              onValueChange={(v) => setNovaPrioridade(v as SuportePrioridade)}
            >
              <SelectTrigger id="prioridade-esc">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {opcoesPrioridade.map((p) => (
                  <SelectItem key={p} value={p}>
                    {SUPORTE_PRIORIDADE_LABEL[p]}
                    {p === prioridadeAtual && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (atual)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo-esc">Motivo do escalonamento</Label>
            <Textarea
              id="motivo-esc"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explique brevemente por que o chamado precisa ser escalado (mínimo 10 caracteres)."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {motivo.trim().length}/10 caracteres mínimos
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={escalonar.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!podeConfirmar}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {escalonar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Escalonar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
