import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExtractedReceiptData {
  supplier_name: string;
  supplier_document?: string;
  total_value: number;
  emission_date?: string;
  document_type?: string;
  document_number?: string;
  suggested_category: string;
  description?: string;
  confidence: number;
}

interface ApprovalSummary {
  summary: string;
  total_pending: number;
  budget_used_percent?: number;
  alerts: { type: "warning" | "danger" | "info"; message: string }[];
  recommendation: string;
}

interface AnomalyResult {
  has_anomaly: boolean;
  anomalies: {
    type: "duplicate" | "high_value" | "vague_description" | "budget_exceeded" | "suspicious";
    severity: "low" | "medium" | "high";
    message: string;
  }[];
}

interface FinancialSuggestions {
  suggested_document_type?: string;
  suggested_portador?: string;
  suggested_due_date_offset_days?: number;
  reasoning?: string;
}

async function invokeAI(action: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("expense-ai-assistant", {
    body: { action, ...params },
  });

  if (error) {
    console.error(`[useExpenseAI] ${action} error:`, error);
    const msg = error.message?.includes("429")
      ? "IA temporariamente indisponível. Tente novamente em instantes."
      : error.message?.includes("402")
      ? "Créditos de IA esgotados. Contate o administrador."
      : "Erro ao processar com IA.";
    toast.error(msg);
    throw error;
  }

  if (data?.error) {
    const msg = data.error.includes("429")
      ? "IA temporariamente indisponível. Tente novamente em instantes."
      : data.error.includes("402")
      ? "Créditos de IA esgotados. Contate o administrador."
      : data.error;
    toast.error(msg);
    throw new Error(data.error);
  }

  return data;
}

export function useReceiptScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ExtractedReceiptData | null>(null);

  const scan = async (imageBase64: string) => {
    setIsScanning(true);
    try {
      const data = await invokeAI("extract_receipt", { imageBase64 });
      setResult(data as ExtractedReceiptData);
      return data as ExtractedReceiptData;
    } finally {
      setIsScanning(false);
    }
  };

  return { scan, isScanning, result, clearResult: () => setResult(null) };
}

export function useExpenseChat() {
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (
    messages: { role: string; content: string }[],
    context: Record<string, unknown> = {}
  ) => {
    setIsLoading(true);
    try {
      const data = await invokeAI("chat", { messages, context });
      return data as { reply: string };
    } finally {
      setIsLoading(false);
    }
  };

  return { sendMessage, isLoading };
}

export function useApprovalSummary() {
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<ApprovalSummary | null>(null);

  const generate = async (entityType: "event" | "department", entityId: string) => {
    setIsLoading(true);
    try {
      const data = await invokeAI("approval_summary", { entityType, entityId });
      setSummary(data as ApprovalSummary);
      return data as ApprovalSummary;
    } finally {
      setIsLoading(false);
    }
  };

  return { generate, isLoading, summary, clearSummary: () => setSummary(null) };
}

export function useAnomalyDetection() {
  const [isChecking, setIsChecking] = useState(false);

  const detect = async (expenseData: Record<string, unknown>) => {
    setIsChecking(true);
    try {
      const data = await invokeAI("detect_anomalies", { expenseData });
      return data as AnomalyResult;
    } finally {
      setIsChecking(false);
    }
  };

  return { detect, isChecking };
}

export function useFinancialSuggestions() {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<FinancialSuggestions | null>(null);

  const suggest = async (expenseId: string) => {
    setIsLoading(true);
    try {
      const data = await invokeAI("suggest_financial_fields", { expenseId });
      const s = (data as { suggestions: FinancialSuggestions }).suggestions;
      setSuggestions(s);
      return s;
    } finally {
      setIsLoading(false);
    }
  };

  return { suggest, isLoading, suggestions, clearSuggestions: () => setSuggestions(null) };
}

export function useEventReport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const generate = async (eventId: string) => {
    setIsGenerating(true);
    try {
      const data = await invokeAI("generate_report", { eventId });
      const r = (data as { report: string }).report;
      setReport(r);
      return r;
    } finally {
      setIsGenerating(false);
    }
  };

  return { generate, isGenerating, report, clearReport: () => setReport(null) };
}

export interface AuditReductionResult {
  risk_score: number;
  summary: string;
  plano_nome: string;
  audit_date: string;
  uncaptured_savings: number;
  critical_items_count: number;
  anomalies: {
    type: "cost_spike" | "stalled_item" | "overdue" | "unrealistic_target" | "duplicate" | "concentration";
    severity: "high" | "medium" | "low";
    fornecedor?: string;
    item?: string;
    description: string;
    recommendation: string;
    impact_value?: number;
  }[];
  trend_data: {
    mes: string;
    fornecedor: string;
    valor_real: number;
    valor_medio: number;
  }[];
  radar_dimensions: {
    custos_crescentes: number;
    prazos_vencidos: number;
    metas_irrealistas: number;
    duplicidades: number;
    concentracao: number;
    itens_parados: number;
  };
}

export function useAuditReductionPlan() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [result, setResult] = useState<AuditReductionResult | null>(null);

  const audit = async (planoId: string) => {
    setIsAuditing(true);
    try {
      const data = await invokeAI("audit_reduction_plan", { planoId });
      setResult(data as AuditReductionResult);
      return data as AuditReductionResult;
    } finally {
      setIsAuditing(false);
    }
  };

  return { audit, isAuditing, result, clearResult: () => setResult(null) };
}
