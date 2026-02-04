import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventExpenses, DOCUMENT_TYPES, usePortadores } from "@/hooks/useEventExpenses";
import { Loader2, Send, FileText, Building2, CreditCard } from "lucide-react";

interface EnviarFinanceiroDialogProps {
  expenseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnviarFinanceiroDialog({ 
  expenseId, 
  open, 
  onOpenChange 
}: EnviarFinanceiroDialogProps) {
  const { sendToFinancial } = useEventExpenses();
  const { data: portadores } = usePortadores();

  const [formData, setFormData] = useState({
    supplier_name: "",
    supplier_document: "",
    document_type: "",
    document_number: "",
    due_date: "",
    portador: "",
    payment_notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier_name || !formData.document_type || !formData.document_number || !formData.due_date || !formData.portador) {
      return;
    }

    await sendToFinancial.mutateAsync({
      id: expenseId,
      supplier_name: formData.supplier_name,
      supplier_document: formData.supplier_document || undefined,
      document_type: formData.document_type,
      document_number: formData.document_number,
      due_date: formData.due_date,
      portador: formData.portador,
      payment_notes: formData.payment_notes || undefined,
    });

    onOpenChange(false);
    setFormData({
      supplier_name: "",
      supplier_document: "",
      document_type: "",
      document_number: "",
      due_date: "",
      portador: "",
      payment_notes: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar para Pagamento
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do fornecedor e documento para enviar ao financeiro
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Fornecedor */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Dados do Fornecedor
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="supplier_name">Nome do Fornecedor *</Label>
              <Input
                id="supplier_name"
                value={formData.supplier_name}
                onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                placeholder="Ex: Buffet Central Ltda"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_document">CNPJ/CPF</Label>
              <Input
                id="supplier_document"
                value={formData.supplier_document}
                onChange={(e) => setFormData({ ...formData, supplier_document: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>

          {/* Dados do Documento */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Dados do Documento
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="document_type">Tipo de Documento *</Label>
                <Select
                  value={formData.document_type}
                  onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document_number">Número do Documento *</Label>
                <Input
                  id="document_number"
                  value={formData.document_number}
                  onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                  placeholder="Ex: 12345"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Data de Vencimento *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="portador">Portador/Forma de Pagamento *</Label>
                <Select
                  value={formData.portador}
                  onValueChange={(value) => setFormData({ ...formData, portador: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {portadores?.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                    <SelectItem value="BRADESCO">BRADESCO</SelectItem>
                    <SelectItem value="ITAU">ITAÚ</SelectItem>
                    <SelectItem value="CARTEIRA">CARTEIRA</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="DEPOSITO">DEPÓSITO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="payment_notes">Observações para Pagamento</Label>
            <Textarea
              id="payment_notes"
              value={formData.payment_notes}
              onChange={(e) => setFormData({ ...formData, payment_notes: e.target.value })}
              placeholder="Informações adicionais para o financeiro..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={sendToFinancial.isPending}>
              {sendToFinancial.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Enviar ao Financeiro
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
