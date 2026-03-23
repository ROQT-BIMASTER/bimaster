import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FinancialSubmissionForm, type FinancialFormData } from "@/components/shared/FinancialSubmissionForm";
import { useFinancialSubmission } from "@/hooks/useFinancialSubmission";

interface EnviarFinanceiroTradeDialogProps {
  entry: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EnviarFinanceiroTradeDialog({
  entry,
  open,
  onOpenChange,
  onSuccess,
}: EnviarFinanceiroTradeDialogProps) {
  const { submit, loading } = useFinancialSubmission();

  const hasAttachments = entry?.attachments && entry.attachments.length > 0;
  const isApproved = entry?.approval_status === "approved";
  const isInstallment = entry?.installment_number && entry?.installment_total;
  const isCorrection = !!entry?.payment_queue_id;

  const initialData = entry ? {
    supplier_name: entry.supplier_name || "",
    supplier_document: entry.supplier_document || "",
    document_type: entry.document_type || "",
    document_number: entry.document_number || "",
    due_date: entry.due_date || "",
    portador: entry.portador || "",
    payment_notes: entry.payment_notes || "",
  } : undefined;

  const handleSubmit = async (formData: FinancialFormData) => {
    if (!isApproved || !hasAttachments) return;

    const success = await submit({
      sourceType: "trade_entry",
      sourceId: entry.id,
      sourceCode: entry.account?.code || null,
      amount: parseFloat(entry.amount),
      description: entry.description || null,
      departmentName: "Trade Marketing",
      attachments: entry.attachments || null,
      empresaId: entry.empresa_id || null,
      empresaNome: entry.empresa_nome || null,
      existingQueueId: entry.payment_queue_id || null,
      installmentNumber: entry.installment_number,
      installmentTotal: entry.installment_total,
      boletoBarcode: entry.boleto_barcode,
      onUpdateSource: async (queueId, data, notes) => {
        await supabase
          .from("trade_financial_entries")
          .update({
            send_to_financial: true,
            status: "pending_financial",
            payment_queue_id: queueId,
            document_type: data.document_type,
            document_number: data.document_number,
            due_date: data.due_date,
            portador: data.portador,
            supplier_name: data.supplier_name,
            supplier_document: data.supplier_document || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", entry.id);
      },
    }, formData);

    if (success) {
      onSuccess();
      onOpenChange(false);
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar para Pagamento
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do fornecedor e documento para enviar ao financeiro
          </DialogDescription>
        </DialogHeader>

        <FinancialSubmissionForm
          expenseId={entry.id}
          isApproved={isApproved}
          hasAttachments={hasAttachments}
          isCorrection={isCorrection}
          installmentInfo={isInstallment ? {
            number: entry.installment_number,
            total: entry.installment_total,
            boletoBarcode: entry.boleto_barcode,
          } : null}
          initialData={initialData}
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
