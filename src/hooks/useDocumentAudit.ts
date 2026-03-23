import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AuditDivergence {
  field: string;
  expected: string;
  found: string;
  severity: "low" | "medium" | "high";
}

export interface DocumentAuditResult {
  matches: boolean;
  divergences: AuditDivergence[];
  confidence: number;
  extracted_cnpj?: string;
  extracted_name?: string;
  extracted_amount?: number;
  extracted_document_number?: string;
  extracted_chave_acesso?: string | null;
}

export function useDocumentAudit() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<DocumentAuditResult | null>(null);

  const audit = async (params: {
    attachmentUrl: string;
    supplierName?: string;
    supplierDocument?: string;
    amount?: number;
    documentNumber?: string;
    documentType?: string;
  }) => {
    setIsAuditing(true);
    try {
      const { data, error } = await supabase.functions.invoke("expense-ai-assistant", {
        body: {
          action: "audit_document",
          ...params,
        },
      });

      if (error) {
        const msg = error.message?.includes("429")
          ? "IA temporariamente indisponível. Tente novamente em instantes."
          : error.message?.includes("402")
          ? "Créditos de IA esgotados."
          : "Erro ao auditar documento.";
        toast.error(msg);
        throw error;
      }

      if (data?.error) {
        toast.error(data.error);
        throw new Error(data.error);
      }

      const result = data as DocumentAuditResult;
      setAuditResult(result);
      return result;
    } catch (err) {
      console.error("[useDocumentAudit] error:", err);
      return null;
    } finally {
      setIsAuditing(false);
    }
  };

  return { audit, isAuditing, auditResult, clearResult: () => setAuditResult(null) };
}
