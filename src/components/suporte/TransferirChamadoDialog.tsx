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
import { Loader2, ArrowRightLeft } from "lucide-react";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { useSuporteAcoes } from "@/hooks/suporte/useSuporteAcoes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  filaAtualId: string | null;
  onTransferido?: () => void;
}

export function TransferirChamadoDialog({
  open,
  onOpenChange,
  ticketId,
  filaAtualId,
  onTransferido,
}: Props) {
  const { data: filas = [] } = useSuporteFilas();
  const { transferir } = useSuporteAcoes();
  const [filaDestinoId, setFilaDestinoId] = useState<string>("");
  const [motivo, setMotivo] = useState("");

  const opcoes = filas.filter(
    (f) => f.id !== filaAtualId && f.ativo && f.aceita_chamados,
  );
  const motivoValido = motivo.trim().length >= 10;
  const podeConfirmar = !!filaDestinoId && motivoValido && !transferir.isPending;

  const handleClose = (v: boolean) => {
    if (transferir.isPending) return;
    if (!v) {
      setFilaDestinoId("");
      setMotivo("");
    }
    onOpenChange(v);
  };

  const handleConfirm = async () => {
    try {
      await transferir.mutateAsync({ ticketId, filaDestinoId, motivo: motivo.trim() });
      handleClose(false);
      onTransferido?.();
    } catch {
      /* toast tratado no hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Transferir chamado
          </DialogTitle>
          <DialogDescription>
            O SLA será recalculado pela política do departamento destino e o solicitante
            será notificado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="fila-destino">Departamento destino</Label>
            <Select value={filaDestinoId} onValueChange={setFilaDestinoId}>
              <SelectTrigger id="fila-destino">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo da transferência</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explique brevemente por que o chamado precisa mudar de departamento (mínimo 10 caracteres)."
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
            disabled={transferir.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!podeConfirmar}>
            {transferir.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
