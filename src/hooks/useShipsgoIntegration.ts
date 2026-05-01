import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeChat } from "@/lib/ai/invokeChat";

export interface DiffRow {
  tipo: "ORFAO_LOCAL" | "ORFAO_SHIPSGO" | "ETA_DIVERGENTE" | "STATUS_DIVERGENTE" | "STALE" | "WEBHOOK_FALHO";
  embarque_id?: string;
  shipment_id?: string;
  container?: string;
  bl?: string;
  status_local?: string | null;
  status_shipsgo?: string | null;
  eta_local?: string | null;
  eta_shipsgo?: string | null;
  dias_atraso?: number | null;
  ultima_atualizacao?: string | null;
  detalhe?: string;
}

export interface DiffKpis {
  total_embarques: number;
  total_shipments: number;
  em_transito: number;
  atrasados: number;
  sem_eta: number;
  webhook_falhos_7d: number;
  divergencias_total: number;
  por_tipo: Record<string, number>;
}

export interface IaAnalise {
  analise_id: string;
  created_at: string;
  model: string;
  relatorio_md: string;
  resumo: { risco_geral: string; top_findings: string[] };
  plano_autofix: Array<{
    acao: string; container?: string; embarque_id?: string;
    shipment_id?: string; motivo: string; prioridade: "P0" | "P1" | "P2";
  }>;
}

export function useShipsgoIntegration() {
  const [loading, setLoading] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);

  const runDiff = useCallback(async (): Promise<{ kpis: DiffKpis; divergencias: DiffRow[] } | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("shipsgo-diff-detect", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao calcular divergências");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const runIa = useCallback(async (kpis: DiffKpis, divergencias: DiffRow[]): Promise<IaAnalise | null> => {
    setIaLoading(true);
    try {
      const { data, error } = await invokeChat<IaAnalise>(
        "shipsgo-ia-diff",
        { kpis, divergencias },
        { timeoutMs: 120_000 },
      );
      if (error) { toast.error(error.userMessage); return null; }
      return data;
    } finally {
      setIaLoading(false);
    }
  }, []);

  const applyAutofix = useCallback(async (
    analise_id: string, password: string, acoes_selecionadas?: number[],
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke("shipsgo-autofix-apply", {
        body: { analise_id, password, acoes_selecionadas },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Auto-fix aplicado: ${data.sucesso}/${data.total} ações`);
      return data;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao aplicar correções");
      return null;
    }
  }, []);

  const replayWebhook = useCallback(async (webhook_id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("shipsgo-webhook-replay", {
        body: { webhook_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Webhook reprocessado");
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no replay");
      return false;
    }
  }, []);

  const listLogs = useCallback(async (limit = 100) => {
    const { data, error } = await (supabase as any)
      .from("shipsgo_webhook_log")
      .select("id, shipsgo_id, event_type, signature_valid, processed_at, error_message, received_at")
      .order("received_at", { ascending: false })
      .limit(limit);
    if (error) { toast.error("Falha ao carregar logs"); return []; }
    return data ?? [];
  }, []);

  const listAnalises = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("shipsgo_ia_analises")
      .select("id, model, resumo, created_at, aplicado_em")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) { toast.error("Falha ao carregar análises"); return []; }
    return data ?? [];
  }, []);

  return { loading, iaLoading, runDiff, runIa, applyAutofix, replayWebhook, listLogs, listAnalises };
}
