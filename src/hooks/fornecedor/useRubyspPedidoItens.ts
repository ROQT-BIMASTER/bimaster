import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PedidoRubyspItem {
  id: number;
  sequencia: number | null;
  produto_id: number | null;
  ean: string | null;
  descricao: string | null;
  unidade: string | null;
  quantidade: number | null;
  preco: number | null;
  desconto: number | null;
  total_item: number | null;
}

export function useRubyspPedidoItens(rubyspPedidoId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["rubysp-pedido-itens", rubyspPedidoId],
    queryFn: async (): Promise<PedidoRubyspItem[]> => {
      if (!rubyspPedidoId) return [];
      const { data, error } = await (supabase as any)
        .from("erp_pedido_itens_rubysp")
        .select("id, sequencia, produto_id, ean, descricao, unidade, quantidade, preco, desconto, total_item")
        .eq("rubysp_pedido_id", rubyspPedidoId)
        .order("sequencia", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PedidoRubyspItem[];
    },
    enabled: Boolean(rubyspPedidoId) && enabled,
    staleTime: 60_000,
  });
}
