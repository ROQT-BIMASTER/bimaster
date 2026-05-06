import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRegistrarApontamentoOP } from "@/hooks/useRegistrarApontamentoOP";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opId: string;
  opNumero: string;
  saldoSugerido?: number;
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function RegistrarApontamentoDialog({ open, onOpenChange, opId, opNumero, saldoSugerido }: Props) {
  const reg = useRegistrarApontamentoOP();
  const [data, setData] = useState(todayLocal());
  const [quantidade, setQuantidade] = useState<string>("");
  const [turno, setTurno] = useState<string>("");
  const [nota, setNota] = useState("");

  const reset = () => {
    setData(todayLocal());
    setQuantidade("");
    setTurno("");
    setNota("");
  };

  const handleSubmit = async () => {
    const qty = Number(quantidade);
    if (!Number.isFinite(qty) || qty <= 0) return;
    await reg.mutateAsync({
      ordem_producao_id: opId,
      data,
      quantidade: qty,
      turno: (turno || undefined) as any,
      nota: nota || undefined,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apontar produção · OP {opNumero}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          <div>
            <Label>
              Quantidade produzida
              {saldoSugerido != null && (
                <span className="text-xs text-muted-foreground ml-2">
                  (saldo sugerido: {saldoSugerido.toLocaleString("pt-BR")})
                </span>
              )}
            </Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="0"
            />
          </div>

          <div>
            <Label>Turno (opcional)</Label>
            <Select value={turno} onValueChange={setTurno}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">Manhã</SelectItem>
                <SelectItem value="tarde">Tarde</SelectItem>
                <SelectItem value="noite">Noite</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Nota (opcional)</Label>
            <Textarea
              value={nota}
              onChange={(e) => setNota(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Observações da produção, refugo, parada, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={reg.isPending || !quantidade || Number(quantidade) <= 0}
          >
            {reg.isPending ? "Registrando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
