import { useCallback, useState } from "react";
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
import { Loader2, Paperclip, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDepartmentExpenses, type DepartmentExpense, type ExpenseAttachment } from "@/hooks/useDepartmentExpenses";
import { FinancialSubmissionForm, type FinancialFormData } from "@/components/shared/FinancialSubmissionForm";

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
  const { sendToFinancial, updateExpense } = useDepartmentExpenses(expense.department_id);
  const [uploading, setUploading] = useState(false);

  const hasAttachments = !!(expense.attachments && expense.attachments.length > 0);
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

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newAttachments: ExpenseAttachment[] = [...(expense.attachments || [])];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uidPrefix = user?.id ? `${user.id}/` : "";

      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name}: excede o limite de 20MB`);
          continue;
        }
        const fileExt = file.name.split(".").pop();
        const fileName = `${uidPrefix}${expense.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("department-expense-docs")
          .upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: signedData, error: signError } = await supabase.storage
          .from("department-expense-docs")
          .createSignedUrl(fileName, 31536000);
        if (signError || !signedData?.signedUrl) throw signError || new Error("Falha ao gerar URL");

        newAttachments.push({
          name: file.name,
          url: signedData.signedUrl,
          type: file.type,
          size: file.size,
          uploaded_at: new Date().toISOString(),
        });
      }

      await updateExpense.mutateAsync({
        id: expense.id,
        attachments: newAttachments,
      });
      toast.success("Anexo(s) enviado(s) com sucesso.");
    } catch (err: any) {
      toast.error(`Erro no upload: ${err?.message || "desconhecido"}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [expense, updateExpense]);

  const handleSubmit = async (formData: FinancialFormData) => {
    if (!isApproved || !hasAttachments) return;

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

        {/* Inline upload — permite anexar sem sair do fluxo */}
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <Label className="flex items-center gap-2 text-sm">
            <Paperclip className="h-4 w-4" />
            Anexos {hasAttachments ? `(${expense.attachments.length})` : "(nenhum)"}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              onChange={handleUpload}
              disabled={uploading}
              className="flex-1"
            />
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          {hasAttachments && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {expense.attachments.map((a, i) => (
                <li key={i} className="truncate">• {a.name}</li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground">
            PDF, imagens, Word ou Excel. Máximo 20MB por arquivo.
          </p>
        </div>

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
