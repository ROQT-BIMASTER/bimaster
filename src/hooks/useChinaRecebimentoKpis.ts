import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OcRecebimentoKpi {
  ordem_compra_id: string;
  numero_oc: string;
  submissao_id: string;
  produto_codigo: string;
  produto_nome: string;
  oc_status: string;
  data_emissao: string | null;
  data_entrega_prevista: string | null;
  data_entrega_real: string | null;
  qty_pedida: number;
  qty_produzida: number;
  qty_embarcada: number;
  qty_recebida: number;
  qty_cancelada: number;
  qty_avariada: number;
  qty_faltante: number;
  saldo_aberto: number;
  data_chegada_porto: string | null;
  data_desembaraco: string | null;
  data_recebimento_cd: string | null;
  sla_porto_cd_dias: number | null;
}

export function useChinaRecebimentoKpis() {
  return useQuery({
    queryKey: ["china-oc-recebimento-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_china_oc_recebimento_kpis" as any)
        .select("*")
        .order("data_emissao", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as OcRecebimentoKpi[];
    },
    staleTime: 30_000,
  });
}

export function useChinaRecebimentoKpi(ordemCompraId: string | undefined) {
  return useQuery({
    queryKey: ["china-oc-recebimento-kpi", ordemCompraId],
    enabled: !!ordemCompraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_china_oc_recebimento_kpis" as any)
        .select("*")
        .eq("ordem_compra_id", ordemCompraId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as OcRecebimentoKpi | null;
    },
  });
}
