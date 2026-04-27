import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChinaOrdemItem {
  id: string;
  ordem_compra_id: string;
  submissao_id: string;
  cor_id: string | null;
  produto_codigo: string;
  sku: string | null;
  cor_nome: string | null;
  qty_pedida: number;
  qty_produzida: number;
  qty_embarcada: number;
  qty_recebida: number;
  qty_cancelada: number;
  preco_unitario_usd: number | null;
  status: "aberto" | "parcial" | "fechado" | "cancelado";
  created_at: string;
  updated_at: string;
}

export function useChinaOrdemItens(ordemId?: string) {
  return useQuery({
    queryKey: ["china-ordem-itens", ordemId],
    enabled: !!ordemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_ordem_itens" as any)
        .select("*")
        .eq("ordem_compra_id", ordemId!)
        .order("cor_nome", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ChinaOrdemItem[];
    },
  });
}

export function useCancelarSaldoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, qty }: { id: string; qty: number }) => {
      const { error } = await supabase
        .from("china_ordem_itens" as any)
        .update({ qty_cancelada: qty } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["china-ordem-itens"] });
      toast.success("Saldo cancelado com sucesso");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao cancelar"),
  });
}
