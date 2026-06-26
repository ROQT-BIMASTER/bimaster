import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PedidoFornecedor {
  futura_pedido_id: number;
  empresa_id: number | null;
  nro_pedido: string | null;
  tipo_pedido_id: number | null;
  data_emissao: string | null;
  data_movimentacao: string | null;
  data_previsao: string | null;
  cliente_futura_id: number | null;
  cliente_nome: string | null;
  cliente_cnpj_cpf: string | null;
  vendedor_futura_id: number | null;
  vendedor_id: string | null;
  vendedor_nome: string | null;
  status: number | null;
  situacao_id: number | null;
  situacao_desc: string | null;
  etapa: string;
  etapa_ordem: number | null;
  urgente: boolean;
  etapa_desde: string | null;
  dias_na_etapa: number | null;
  em_andamento: boolean;
  total_produto: number | null;
  total_desconto: number | null;
  total_pedido: number | null;
  observacao: string | null;
  data_cancelamento: string | null;
  motivo_cancelamento: string | null;
  sincronizado_em: string | null;
}

interface UseFornecedorPedidosArgs {
  dateFrom?: Date;
  dateTo?: Date;
}

export function useFornecedorPedidos({ dateFrom, dateTo }: UseFornecedorPedidosArgs) {
  return useQuery({
    queryKey: ["fornecedor-pedidos", dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async (): Promise<PedidoFornecedor[]> => {
      let q = (supabase as any)
        .from("v_pedidos")
        .select("*")
        .order("data_emissao", { ascending: false })
        .limit(5000);
      if (dateFrom) q = q.gte("data_emissao", dateFrom.toISOString().slice(0, 10));
      if (dateTo) q = q.lte("data_emissao", dateTo.toISOString().slice(0, 10));
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PedidoFornecedor[];
    },
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}
