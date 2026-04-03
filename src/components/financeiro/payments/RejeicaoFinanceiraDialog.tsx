import { useState, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, XCircle, Loader2 } from "lucide-react";

export interface RejectionData {
  category: string;
  fields: string[];
  notes: string;
}

interface RejeicaoFinanceiraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierName: string;
  amount: number;
  code: string;
  onConfirmar: (data: RejectionData) => void;
  isProcessing?: boolean;
}

const REJECTION_CATEGORIES = [
  { value: "pix_incorreto", label: "Dados de PIX incorretos" },
  { value: "boleto_invalido", label: "Boleto inválido / vencido" },
  { value: "nf_ausente", label: "NF ausente ou inválida" },
  { value: "valor_divergente", label: "Valor divergente" },
  { value: "fornecedor_incorreto", label: "Fornecedor incorreto" },
  { value: "dados_bancarios", label: "Dados bancários incompletos (TED/DOC)" },
  { value: "documento_ilegivel", label: "Documento ilegível" },
  { value: "duplicidade", label: "Duplicidade de lançamento" },
  { value: "outro", label: "Outro" },
] as const;

const CATEGORY_FIELDS: Record<string, string[]> = {
  pix_incorreto: ["Chave PIX", "Tipo de Chave", "ID Transação"],
  boleto_invalido: ["Linha Digitável", "Data de Vencimento", "Código de Barras"],
  nf_ausente: ["Número NF", "Anexo da NF", "CNPJ Emissor"],
  valor_divergente: ["Valor do Lançamento", "Parcela", "Desconto"],
  fornecedor_incorreto: ["Nome do Fornecedor", "CNPJ", "Razão Social"],
  dados_bancarios: ["Banco", "Agência", "Conta", "Tipo de Conta"],
  documento_ilegivel: ["Anexo Principal", "Comprovante", "NF"],
  duplicidade: ["Código Origem", "Data do Lançamento"],
  outro: [],
};

export const REJECTION_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  REJECTION_CATEGORIES.map((c) => [c.value, c.label])
);

// formatCurrency importado abaixo

export function RejeicaoFinanceiraDialog({
  open,
  onOpenChange,
  supplierName,
  amount,
  code,
  onConfirmar,
  isProcessing,
}: RejeicaoFinanceiraDialogProps) {
  const [category, setCategory] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const availableFields = useMemo(() => CATEGORY_FIELDS[category] || [], [category]);

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setSelectedFields([]);
  };

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const canConfirm = category && (category === "outro" ? notes.trim().length > 0 : true);

  const handleConfirmar = () => {
    if (!canConfirm) return;
    onConfirmar({ category, fields: selectedFields, notes });
    setCategory("");
    setSelectedFields([]);
    setNotes("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setCategory("");
    setSelectedFields([]);
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Rejeitar Pagamento
          </DialogTitle>
          <DialogDescription>
            Informe o motivo da rejeição para orientar o solicitante na correção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <p>
              <strong>Código:</strong> {code}
            </p>
            <p>
              <strong>Fornecedor:</strong> {supplierName}
            </p>
            <p>
              <strong>Valor:</strong>{" "}
              <span className="font-bold text-primary">{formatCurrency(amount)}</span>
            </p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoria do problema *</Label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Affected Fields */}
          {availableFields.length > 0 && (
            <div className="space-y-2">
              <Label>Campos a corrigir</Label>
              <div className="grid grid-cols-2 gap-2">
                {availableFields.map((field) => (
                  <label
                    key={field}
                    className="flex items-center gap-2 cursor-pointer rounded-md border border-input p-2 text-sm hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedFields.includes(field)}
                      onCheckedChange={() => toggleField(field)}
                    />
                    {field}
                  </label>
                ))}
              </div>
              {selectedFields.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedFields.map((f) => (
                    <Badge key={f} variant="destructive" className="text-[10px]">
                      {f}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="space-y-2">
            <Label>
              Instruções ao solicitante{category === "outro" ? " *" : ""}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva o que o solicitante precisa corrigir..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmar}
            disabled={!canConfirm || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <XCircle className="h-4 w-4 mr-1.5" />
            )}
            Confirmar Rejeição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
