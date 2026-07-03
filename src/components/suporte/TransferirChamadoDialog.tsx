import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { useSuporteAcoes } from "@/hooks/suporte/useSuporteAcoes";
import type { SuporteChamado } from "@/hooks/suporte/types";

interface Props {
  chamado: SuporteChamado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado saiu da fila atual — a página pode limpar a seleção. */
  onTransferido?: () => void;
}

export function TransferirChamadoDialog({ chamado, open, onOpenChange, onTransferido }: Props) {
  const { data: filas = [] } = useSuporteFilas();
  const { transferir } = useSuporteAcoes();
  const [paraFilaId, setParaFilaId] = useState<string>("");
  const [motivo, setMotivo] = useState("");

  const destinos = filas.filter((f) => f.aceita_chamados && f.id !== chamado?.fila_id);
  const podeEnviar = !!chamado && !!paraFilaId && !transferir.isPending;

  const submit = async () => {
    if (!podeEnviar || !chamado) return;
    await transferir.mutateAsync({
      ticketId: chamado.id,
      paraFilaId,
      motivo: motivo.trim() || undefined,
    });
    setParaFilaId("");
    setMotivo("");
    onOpenChange(false);
    onTransferido?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transferir chamado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {chamado?.protocolo && <span className="font-mono">{chamado.protocolo}</span>}{" "}
            {chamado?.titulo} — atualmente em <strong>{chamado?.fila?.nome ?? "?"}</strong>.
            O solicitante será notificado e o chamado volta ao status "Novo" na fila destino.
          </p>
          <div className="space-y-2">
            <Label>Departamento destino *</Label>
            <Select value={paraFilaId} onValueChange={setParaFilaId}>
              <SelectTrigger>
                <SelectValue placeholder="Para qual departamento?" />
              </SelectTrigger>
              <SelectContent>
                {destinos.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por que este chamado pertence ao outro departamento? (vai para a trilha e para a thread)"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!podeEnviar}>
            {transferir.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
