import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Linha única de `vw_lead_time_etapas_rubysp` (janela fixa de 30d, definida no banco).
 * p50_* em minutos; média também em minutos.
 */
export interface RubyspLeadTimeRow {
  n_liberacao: number | null;
  p50_ate_liberacao_min: number | null;
  p50_aguard_separacao_min: number | null;
  p50_separacao_min: number | null;
  p50_aguard_expedicao_min: number | null;
  p50_faturamento_min: number | null;
  p50_entrega_transito_min: number | null;
  p50_lead_time_min: number | null;
  media_lead_time_min: number | null;
  p50_lead_time_entrega_min: number | null;
  media_lead_time_entrega_min: number | null;
}

export function useRubyspLeadTime() {
  return useQuery({
    queryKey: ["rubysp-lead-time"],
    queryFn: async (): Promise<RubyspLeadTimeRow | null> => {
      const { data, error } = await (supabase as any)
        .from("vw_lead_time_etapas_rubysp")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as RubyspLeadTimeRow | null;
    },
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });
}
