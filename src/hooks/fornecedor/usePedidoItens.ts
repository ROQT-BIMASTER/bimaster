import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PedidoItem {
  id: number;
  futura_item_id: number;
  futura_pedido_id: number;
  sequencia: number | null;
  produto_futura_id: number | null;
  cod_produto: string | null;
  ean: string | null;
  descricao: string | null;
  quantidade: number | null;
  valor_unitario: number | null;
  desconto_valor: number | null;
  total_item: number | null;
}

export function usePedidoItens(futuraPedidoId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["pedido-itens", futuraPedidoId],
    queryFn: async (): Promise<PedidoItem[]> => {
      if (!futuraPedidoId) return [];
      const { data, error } = await (supabase as any)
        .from("erp_pedidos_item")
        .select(
          "id, futura_item_id, futura_pedido_id, sequencia, produto_futura_id, cod_produto, ean, descricao, quantidade, valor_unitario, desconto_valor, total_item",
        )
        .eq("futura_pedido_id", futuraPedidoId)
        .order("sequencia", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as PedidoItem[];
    },
    enabled: Boolean(futuraPedidoId) && enabled,
    staleTime: 60_000,
  });
}
