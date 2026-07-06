import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useVincularEvidencia,
  type SuporteEvidencia,
} from "@/hooks/suporte/useEvidencias";
import { useTicketPareceres, useTicketTrilhaDepartamentos } from "@/hooks/suporte/usePareceres";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evidencia: SuporteEvidencia | null;
}

const NONE = "__none__";

export function EvidenciaVinculoDialog({ open, onOpenChange, evidencia }: Props) {
  const { data: pareceres = [] } = useTicketPareceres(evidencia?.ticket_id ?? null);
  const { data: trilha = [] } = useTicketTrilhaDepartamentos(evidencia?.ticket_id ?? null);
  const { data: filas = [] } = useSuporteFilas();
  const vincular = useVincularEvidencia();

  const [parecerId, setParecerId] = useState<string>(NONE);
  const [trilhaId, setTrilhaId] = useState<string>(NONE);

  useEffect(() => {
    if (open && evidencia) {
      setParecerId(evidencia.parecer_id ?? NONE);
      setTrilhaId(evidencia.trilha_id ?? NONE);
    }
  }, [open, evidencia]);

  const nomeFila = (id: string | null) =>
    id ? filas.find((f) => f.id === id)?.nome ?? "—" : "—";

  async function submit() {
    if (!evidencia) return;
    await vincular.mutateAsync({
      evidencia_id: evidencia.id,
      ticket_id: evidencia.ticket_id,
      parecer_id: parecerId === NONE ? null : parecerId,
      trilha_id: trilhaId === NONE ? null : trilhaId,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Vincular evidência
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-md border bg-muted/30 p-2 text-xs">
            <div className="font-medium truncate">{evidencia?.nome_arquivo}</div>
            <div className="text-muted-foreground">
              SHA {evidencia?.hash_sha256.slice(0, 12)}…
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Parecer</Label>
            <Select value={parecerId} onValueChange={setParecerId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Sem vínculo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem vínculo</SelectItem>
                {pareceres.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.tipo} — {p.titulo || `#${p.id.slice(0, 6)}`} ·{" "}
                    {format(new Date(p.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Etapa da trilha de departamentos</Label>
            <Select value={trilhaId} onValueChange={setTrilhaId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Sem vínculo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem vínculo</SelectItem>
                {trilha.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {nomeFila(t.fila_id)} · {t.status} ·{" "}
                    {format(new Date(t.entrou_em), "dd/MM HH:mm", { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={vincular.isPending}
          >
            Cancelar
          </Button>
          <Button size="sm" onClick={submit} disabled={vincular.isPending}>
            {vincular.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar vínculo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
