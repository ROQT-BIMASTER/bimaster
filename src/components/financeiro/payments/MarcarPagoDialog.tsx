import { useState } from "react";
import { formatCurrency } from "@/lib/formatters";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MarcarPagoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierName: string;
  amount: number;
  dueDate: string;
  code: string;
  onConfirmar: (paymentMethod: string, paymentDetails: Record<string, string>, observacoes: string) => void;
  isProcessing: boolean;
}

const metodosPagamento = [
  "PIX",
  "Boleto",
  "TED",
  "DOC",
  "Débito Automático",
  "Cartão",
];

const tiposChavePix = ["CPF/CNPJ", "E-mail", "Telefone", "Chave Aleatória"];

// formatCurrency importado abaixo

export function MarcarPagoDialog({
  open,
  onOpenChange,
  supplierName,
  amount,
  dueDate,
  code,
  onConfirmar,
  isProcessing,
}: MarcarPagoDialogProps) {
  const [metodo, setMetodo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});

  const updateDetail = (key: string, value: string) => {
    setDetails((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirmar = () => {
    if (!metodo) return;
    onConfirmar(metodo, details, observacoes);
    setMetodo("");
    setDetails({});
    setObservacoes("");
  };

  const handleClose = () => {
    setMetodo("");
    setDetails({});
    setObservacoes("");
    onOpenChange(false);
  };

  const isValid = metodo.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Marcar como Pago
          </DialogTitle>
          <DialogDescription>
            Informe o método de pagamento utilizado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo do pagamento */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <p>
              <strong>Código:</strong> {code}
            </p>
            <p>
              <strong>Fornecedor:</strong> {supplierName}
            </p>
            <div className="flex gap-4">
              <span>
                Valor: <strong className="text-primary">{formatCurrency(amount)}</strong>
              </span>
              <span>
                Vencimento:{" "}
                <strong>
                  {format(new Date(dueDate), "dd/MM/yyyy", { locale: ptBR })}
                </strong>
              </span>
            </div>
          </div>

          {/* Método de pagamento */}
          <div className="space-y-2">
            <Label>Método de Pagamento *</Label>
            <Select value={metodo} onValueChange={(v) => { setMetodo(v); setDetails({}); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o método" />
              </SelectTrigger>
              <SelectContent>
                {metodosPagamento.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campos condicionais por método */}
          {metodo === "PIX" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label>Tipo de Chave</Label>
                <Select value={details.tipo_chave || ""} onValueChange={(v) => updateDetail("tipo_chave", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposChavePix.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chave PIX</Label>
                <Input
                  value={details.chave_pix || ""}
                  onChange={(e) => updateDetail("chave_pix", e.target.value)}
                  placeholder="Informe a chave PIX utilizada"
                />
              </div>
              <div className="space-y-2">
                <Label>ID da Transação</Label>
                <Input
                  value={details.id_transacao || ""}
                  onChange={(e) => updateDetail("id_transacao", e.target.value)}
                  placeholder="ID / E2E da transação"
                />
              </div>
            </div>
          )}

          {metodo === "Boleto" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label>Linha Digitável</Label>
                <Input
                  value={details.linha_digitavel || ""}
                  onChange={(e) => updateDetail("linha_digitavel", e.target.value)}
                  placeholder="Código de barras / linha digitável"
                />
              </div>
              <div className="space-y-2">
                <Label>Data do Pagamento</Label>
                <Input
                  type="date"
                  value={details.data_pagamento || ""}
                  onChange={(e) => updateDetail("data_pagamento", e.target.value)}
                />
              </div>
            </div>
          )}

          {(metodo === "TED" || metodo === "DOC") && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label>Banco Destino</Label>
                <Input
                  value={details.banco_destino || ""}
                  onChange={(e) => updateDetail("banco_destino", e.target.value)}
                  placeholder="Nome ou código do banco"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Agência</Label>
                  <Input
                    value={details.agencia || ""}
                    onChange={(e) => updateDetail("agencia", e.target.value)}
                    placeholder="Agência"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conta</Label>
                  <Input
                    value={details.conta || ""}
                    onChange={(e) => updateDetail("conta", e.target.value)}
                    placeholder="Conta"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>ID da Transação</Label>
                <Input
                  value={details.id_transacao || ""}
                  onChange={(e) => updateDetail("id_transacao", e.target.value)}
                  placeholder="Número de controle"
                />
              </div>
            </div>
          )}

          {metodo === "Débito Automático" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label>Referência</Label>
                <Input
                  value={details.referencia || ""}
                  onChange={(e) => updateDetail("referencia", e.target.value)}
                  placeholder="Número de referência do débito"
                />
              </div>
            </div>
          )}

          {metodo === "Cartão" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Últimos 4 dígitos</Label>
                  <Input
                    value={details.ultimos_digitos || ""}
                    onChange={(e) => updateDetail("ultimos_digitos", e.target.value)}
                    placeholder="0000"
                    maxLength={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bandeira</Label>
                  <Input
                    value={details.bandeira || ""}
                    onChange={(e) => updateDetail("bandeira", e.target.value)}
                    placeholder="Visa, Master..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>ID da Transação</Label>
                <Input
                  value={details.id_transacao || ""}
                  onChange={(e) => updateDetail("id_transacao", e.target.value)}
                  placeholder="Número de autorização"
                />
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais sobre o pagamento..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!isValid || isProcessing}>
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Wallet className="h-4 w-4 mr-2" />
            )}
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
