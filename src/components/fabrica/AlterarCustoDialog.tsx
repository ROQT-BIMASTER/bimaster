import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insumoNome: string;
  campo: string;
  valorAnterior: number;
  valorNovo: number;
  onConfirmar: (motivo: string) => void;
}

const campoLabels: Record<string, string> = {
  custo_nf: "Custo NF",
  custo_servico: "Custo Serviço",
  custo_condicao: "Custo Condição",
};

const motivosPredefinidos = [
  "Reajuste de fornecedor",
  "Nova negociação comercial",
  "Cotação aprovada",
  "Alteração cambial",
  "Correção de lançamento",
  "Atualização de tabela",
  "Outro",
];

export function AlterarCustoDialog({
  open,
  onOpenChange,
  insumoNome,
  campo,
  valorAnterior,
  valorNovo,
  onConfirmar,
}: Props) {
  const [motivoSelecionado, setMotivoSelecionado] = useState("");
  const [motivoTexto, setMotivoTexto] = useState("");

  const formatarMoeda = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 6 });

  const aumentou = valorNovo > valorAnterior;
  const variacao = valorAnterior > 0 ? ((valorNovo - valorAnterior) / valorAnterior) * 100 : 0;

  const handleConfirmar = () => {
    const motivo = motivoSelecionado === "Outro" ? motivoTexto : motivoSelecionado;
    if (!motivo.trim()) return;
    onConfirmar(motivo);
    setMotivoSelecionado("");
    setMotivoTexto("");
    onOpenChange(false);
  };

  const motivoFinal = motivoSelecionado === "Outro" ? motivoTexto : motivoSelecionado;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Justificar Alteração de Custo
          </DialogTitle>
          <DialogDescription>
            Informe o motivo da alteração para registro no histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <p><strong>Insumo:</strong> {insumoNome}</p>
            <p><strong>Campo:</strong> {campoLabels[campo] || campo}</p>
            <div className="flex gap-4">
              <span>Anterior: <strong>{formatarMoeda(valorAnterior)}</strong></span>
              <span>Novo: <strong className={aumentou ? "text-red-600" : "text-green-600"}>{formatarMoeda(valorNovo)}</strong></span>
              {valorAnterior > 0 && (
                <span className={`font-medium ${aumentou ? "text-red-600" : "text-green-600"}`}>
                  ({aumentou ? "+" : ""}{variacao.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Select value={motivoSelecionado} onValueChange={setMotivoSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivosPredefinidos.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {motivoSelecionado === "Outro" && (
            <div className="space-y-2">
              <Label>Descreva o motivo *</Label>
              <Textarea
                value={motivoTexto}
                onChange={(e) => setMotivoTexto(e.target.value)}
                placeholder="Descreva o motivo da alteração..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!motivoFinal?.trim()}>
            Confirmar Alteração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
