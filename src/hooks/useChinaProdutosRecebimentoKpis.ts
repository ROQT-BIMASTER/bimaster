import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProdutoChinaRecebimentoKpi {
  submissao_id: string;
  produto_codigo: string;
  produto_nome: string;
  status_submissao: string | null;
  linha_produto: string | null;
  qtd_ocs: number;
  qtd_ocs_ativas: number;
  qty_pedida: number;
  qty_embarcada: number;
  qty_recebida: number;
  qty_saldo: number;
  qty_avariada: number;
  qty_faltante: number;
  data_ultima_oc: string | null;
  data_proxima_entrega_prevista: string | null;
}

export function useChinaProdutosRecebimentoKpis() {
  return useQuery({
    queryKey: ["china-produto-recebimento-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_china_produto_recebimento_kpis" as any)
        .select("*")
        .order("data_ultima_oc", { ascending: false, nullsFirst: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as unknown as ProdutoChinaRecebimentoKpi[];
    },
    staleTime: 30_000,
  });
}
