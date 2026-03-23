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
import { FinancialSubmissionForm, type FinancialFormData, type SiblingInstallment } from "@/components/shared/FinancialSubmissionForm";
import { useFinancialSubmission } from "@/hooks/useFinancialSubmission";

interface EnviarFinanceiroDialogProps {
  expenseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnviarFinanceiroDialog({
  expenseId,
  open,
  onOpenChange,
}: EnviarFinanceiroDialogProps) {
  const { submit, loading } = useFinancialSubmission();
  const [siblingEntries, setSiblingEntries] = useState<SiblingInstallment[]>([]);
  const [expenseInfo, setExpenseInfo] = useState<{
    status: string | null;
    attachments: any[] | null;
    installment_number: number | null;
    installment_total: number | null;
    installment_group_id: string | null;
    boleto_barcode: string | null;
    payment_queue_id: string | null;
    supplier_name: string | null;
    supplier_document: string | null;
    document_type: string | null;
    document_number: string | null;
    due_date: string | null;
    portador: string | null;
    payment_notes: string | null;
    valor_realizado: number;
    valor_previsto: number;
    description: string | null;
    event_id: string | null;
    empresa_id: number | null;
    empresa_nome: string | null;
  } | null>(null);

  // Fetch expense info + siblings when dialog opens
  useEffect(() => {
    if (!open) {
      setExpenseInfo(null);
      setSiblingEntries([]);
      return;
    }

    supabase
      .from("corporate_event_expenses")
      .select("status, attachments, installment_number, installment_total, installment_group_id, boleto_barcode, payment_queue_id, supplier_name, supplier_document, document_type, document_number, due_date, portador, payment_notes, valor_realizado, valor_previsto, description, event_id, empresa_id, empresa_nome")
      .eq("id", expenseId)
      .single()
      .then(({ data }) => {
        if (data) {
          const info = {
            status: data.status,
            attachments: (data.attachments as any[]) || [],
            installment_number: data.installment_number,
            installment_total: data.installment_total,
            installment_group_id: (data as any).installment_group_id || null,
            boleto_barcode: data.boleto_barcode,
            payment_queue_id: (data as any).payment_queue_id || null,
            supplier_name: (data as any).supplier_name || null,
            supplier_document: (data as any).supplier_document || null,
            document_type: (data as any).document_type || null,
            document_number: (data as any).document_number || null,
            due_date: (data as any).due_date || null,
            portador: (data as any).portador || null,
            payment_notes: (data as any).payment_notes || null,
            valor_realizado: data.valor_realizado || 0,
            valor_previsto: data.valor_previsto || 0,
            description: data.description || null,
            event_id: data.event_id || null,
            empresa_id: (data as any).empresa_id || null,
            empresa_nome: (data as any).empresa_nome || null,
          };
          setExpenseInfo(info);

          // Fetch sibling installments
          if (info.installment_group_id) {
            supabase
              .from("corporate_event_expenses")
              .select("id, installment_number, installment_total, valor_realizado, valor_previsto, due_date, status, boleto_barcode")
              .eq("installment_group_id", info.installment_group_id)
              .neq("id", expenseId)
              .order("installment_number")
              .then(({ data: siblings }) => {
                setSiblingEntries((siblings || []) as unknown as SiblingInstallment[]);
              });
          }
        }
      });
  }, [open, expenseId]);

  const hasAttachments = expenseInfo?.attachments && expenseInfo.attachments.length > 0;
  const isApproved = expenseInfo?.status === "approved";
  const isInstallment = !!(expenseInfo?.installment_number) && !!(expenseInfo?.installment_total);
  const isCorrection = !!expenseInfo?.payment_queue_id;

  const initialData = expenseInfo?.payment_queue_id || expenseInfo?.supplier_name ? {
    supplier_name: expenseInfo.supplier_name || "",
    supplier_document: expenseInfo.supplier_document || "",
    document_type: expenseInfo.document_type || "",
    document_number: expenseInfo.document_number || "",
    due_date: expenseInfo.due_date || "",
    portador: expenseInfo.portador || "",
    payment_notes: expenseInfo.payment_notes || "",
  } : undefined;

  const handleSubmit = async (formData: FinancialFormData) => {
    if (!expenseInfo || !isApproved || !hasAttachments) return;

    const success = await submit({
      sourceType: "event_expense",
      sourceId: expenseId,
      amount: expenseInfo.valor_realizado || expenseInfo.valor_previsto || 0,
      description: expenseInfo.description || null,
      departmentName: "Eventos Corporativos",
      attachments: expenseInfo.attachments || null,
      empresaId: expenseInfo.empresa_id || null,
      empresaNome: expenseInfo.empresa_nome || null,
      existingQueueId: expenseInfo.payment_queue_id || null,
      installmentNumber: expenseInfo.installment_number,
      installmentTotal: expenseInfo.installment_total,
      boletoBarcode: expenseInfo.boleto_barcode,
      onUpdateSource: async (queueId, data, notes) => {
        await supabase
          .from("corporate_event_expenses")
          .update({
            payment_queue_id: queueId,
            supplier_name: data.supplier_name,
            supplier_document: data.supplier_document || null,
            document_type: data.document_type,
            document_number: data.document_number,
            due_date: data.due_date,
            portador: data.portador,
            payment_notes: notes,
          })
          .eq("id", expenseId);
      },
    }, formData);

    if (success) {
      onOpenChange(false);
    }
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
            Preencha os dados do fornecedor e documento para enviar ao financeiro
          </DialogDescription>
        </DialogHeader>

        {expenseInfo && (
          <FinancialSubmissionForm
            expenseId={expenseId}
            isApproved={isApproved}
            hasAttachments={!!hasAttachments}
            isCorrection={isCorrection}
            installmentInfo={isInstallment ? {
              number: expenseInfo.installment_number!,
              total: expenseInfo.installment_total!,
              boletoBarcode: expenseInfo.boleto_barcode,
            } : null}
            siblingInstallments={siblingEntries}
            initialData={initialData}
            loading={loading}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
