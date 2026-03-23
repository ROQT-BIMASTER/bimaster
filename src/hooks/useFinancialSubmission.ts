import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";
import type { FinancialFormData } from "@/components/shared/FinancialSubmissionForm";

export type SourceType = "trade_entry" | "department_expense" | "event_expense";

export interface FinancialSubmissionConfig {
  sourceType: SourceType;
  sourceId: string;
  sourceCode?: string | null;
  amount: number;
  description?: string | null;
  departmentName: string;
  attachments?: any[] | null;
  empresaId?: number | null;
  empresaNome?: string | null;
  existingQueueId?: string | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  boletoBarcode?: string | null;
  /** Callback to update the source table after queue insert/update */
  onUpdateSource?: (queueId: string, formData: FinancialFormData, notes: string | null) => Promise<void>;
}

export function useFinancialSubmission() {
  const [loading, setLoading] = useState(false);

  const submit = async (config: FinancialSubmissionConfig, formData: FinancialFormData) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Validate required fields
      if (!formData.supplier_name || !formData.document_type || !formData.document_number || !formData.due_date || !formData.portador) {
        toast.error("Preencha todos os campos obrigatórios");
        setLoading(false);
        return false;
      }

      // Get user name for history
      let userName = "Usuário";
      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user.id).single();
      if (profile?.nome) userName = profile.nome;

      // Build notes with boleto and installment info
      const noteParts: string[] = [];
      if (formData.payment_notes) noteParts.push(formData.payment_notes);
      if (config.boletoBarcode) noteParts.push(`Linha digitável: ${config.boletoBarcode}`);
      if (config.installmentNumber && config.installmentTotal) {
        noteParts.push(`Parcela ${config.installmentNumber}/${config.installmentTotal}`);
      }
      const notes = noteParts.join(" | ") || null;

      const queuePayload = {
        source_type: config.sourceType,
        source_id: config.sourceId,
        source_code: config.sourceCode || null,
        supplier_name: formData.supplier_name,
        supplier_document: formData.supplier_document || null,
        document_type: formData.document_type,
        document_number: formData.document_number,
        amount: config.amount,
        due_date: formData.due_date,
        portador: formData.portador,
        description: config.description || null,
        notes,
        department_name: config.departmentName,
        requested_by: user.id,
        attachments: config.attachments || null,
        empresa_id: config.empresaId || null,
        empresa_nome: config.empresaNome || null,
      };

      let finalQueueId = config.existingQueueId;

      if (config.existingQueueId) {
        // CORRECTION: Update existing record
        const { error: updateQueueError } = await supabase
          .from("financial_payment_queue")
          .update({
            ...queuePayload,
            financial_status: "pending",
            financial_notes: null,
            reviewed_at: null,
            reviewed_by: null,
            rejection_category: null,
            rejection_fields: null,
          })
          .eq("id", config.existingQueueId);

        if (updateQueueError) throw updateQueueError;

        await supabase.from("financial_payment_queue_history" as any).insert({
          payment_queue_id: config.existingQueueId,
          changed_by: user.id,
          changed_by_name: userName,
          action: "corrected",
          snapshot: queuePayload,
        });
      } else {
        // FIRST SUBMISSION
        const code = `${config.sourceType === "trade_entry" ? "TRD" : config.sourceType === "department_expense" ? "DEP" : "EVT"}-${Date.now()}`;
        const { data: queueEntry, error: queueError } = await supabase
          .from("financial_payment_queue")
          .insert({ code, ...queuePayload })
          .select("id")
          .single();

        if (queueError) throw queueError;
        finalQueueId = queueEntry.id;

        await supabase.from("financial_payment_queue_history" as any).insert({
          payment_queue_id: queueEntry.id,
          changed_by: user.id,
          changed_by_name: userName,
          action: "submitted",
          snapshot: queuePayload,
        });
      }

      // Update the source table
      if (config.onUpdateSource && finalQueueId) {
        await config.onUpdateSource(finalQueueId, formData, notes);
      }

      toast.success("Enviado ao financeiro com sucesso!");
      return true;
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading };
}
