import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { useSolicitarSuplementacao } from "@/hooks/orcamento/useSuplementacoes";

export function SuplementacaoDialog({
  open,
  onOpenChange,
  periodId,
  distributionId,
  departmentNome,
  valorAlocado,
  saldoLivre,
  alertaId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  distributionId: string;
  departmentNome: string | null;
  valorAlocado: number;
  saldoLivre: number;
  alertaId?: string | null;
}) {
  const [valor, setValor] = useState<string>("");
  const [justificativa, setJustificativa] = useState<string>("");
  const solicitar = useSolicitarSuplementacao(periodId);

  const valorNumber = Number(valor.replace(/\./g, "").replace(",", "."));
  const canSubmit =
    !isNaN(valorNumber) && valorNumber > 0 && justificativa.trim().length >= 5;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await solicitar.mutateAsync({
      distribution_id: distributionId,
      valor: valorNumber,
      justificativa: justificativa.trim(),
      alerta_id: alertaId ?? null,
    });
    setValor("");
    setJustificativa("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar suplementação de verba</DialogTitle>
          <DialogDescription>
            {departmentNome ?? "Departamento"} — verba alocada atual: {formatCurrency(valorAlocado)}
            {saldoLivre < 0 && (
              <span className="text-destructive">
                {" "}
                (saldo atual: {formatCurrency(saldoLivre)})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sup-valor">Valor solicitado</Label>
            <Input
              id="sup-valor"
              type="text"
              inputMode="decimal"
              placeholder="Ex.: 50000,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sup-just">Justificativa</Label>
            <Textarea
              id="sup-just"
              rows={4}
              placeholder="Explique por que a verba adicional é necessária"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Mínimo 5 caracteres.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={solicitar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || solicitar.isPending}>
            {solicitar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Solicitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
