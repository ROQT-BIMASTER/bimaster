import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDepartmentExpenses, type DepartmentExpense } from "@/hooks/useDepartmentExpenses";
import { FinancialSubmissionForm, type FinancialFormData } from "@/components/shared/FinancialSubmissionForm";
import { useFinancialSubmission } from "@/hooks/useFinancialSubmission";

interface EnviarFinanceiroDepDialogProps {
  expense: DepartmentExpense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnviarFinanceiroDepDialog({
  expense,
  open,
  onOpenChange,
}: EnviarFinanceiroDepDialogProps) {
  const { sendToFinancial } = useDepartmentExpenses(expense.department_id);
  const { submit, loading } = useFinancialSubmission();

  const hasAttachments = expense.attachments && expense.attachments.length > 0;
  const isApproved = expense.status === "approved";
  const isInstallment = !!(expense as any).installment_number && !!(expense as any).installment_total;
  const isCorrection = !!(expense as any).payment_queue_id;

  const initialData = isCorrection || (expense as any).supplier_name ? {
    supplier_name: (expense as any).supplier_name || "",
    supplier_document: (expense as any).supplier_document || "",
    document_type: (expense as any).document_type || "",
    document_number: (expense as any).document_number || "",
    due_date: (expense as any).due_date || "",
    portador: (expense as any).portador || "",
    payment_notes: (expense as any).payment_notes || "",
  } : undefined;

  const handleSubmit = async (formData: FinancialFormData) => {
    if (!isApproved || !hasAttachments) return;

    // Build notes
    const noteParts: string[] = [];
    if (formData.payment_notes) noteParts.push(formData.payment_notes);
    if ((expense as any).boleto_barcode) noteParts.push(`Linha digitável: ${(expense as any).boleto_barcode}`);
    if (isInstallment) noteParts.push(`Parcela ${(expense as any).installment_number}/${(expense as any).installment_total}`);
    const notes = noteParts.join(" | ") || undefined;

    await sendToFinancial.mutateAsync({
      id: expense.id,
      supplier_name: formData.supplier_name,
      supplier_document: formData.supplier_document || undefined,
      document_type: formData.document_type,
      document_number: formData.document_number,
      due_date: formData.due_date,
      portador: formData.portador,
      payment_notes: notes,
      payment_queue_id: (expense as any).payment_queue_id || null,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar para Pagamento
          </DialogTitle>
          <DialogDescription>
            Despesa: {expense.code} - {expense.description || expense.category}
          </DialogDescription>
        </DialogHeader>

        <FinancialSubmissionForm
          expenseId={expense.id}
          isApproved={isApproved}
          hasAttachments={hasAttachments}
          isCorrection={isCorrection}
          installmentInfo={isInstallment ? {
            number: (expense as any).installment_number,
            total: (expense as any).installment_total,
            boletoBarcode: (expense as any).boleto_barcode,
          } : null}
          initialData={initialData}
          loading={sendToFinancial.isPending}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
