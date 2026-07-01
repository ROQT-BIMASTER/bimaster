import { toFriendlyPermissionMessage } from "@/lib/utils/permissionErrors";
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

/**
 * Cancela parte do saldo de um item de OC chamando a RPC com snapshot,
 * lock e validação de motivo. Substitui o UPDATE direto que bypassava
 * `rpc_china_oc_cancelar_saldo_item` (achado #2 da auditoria China).
 *
 * `qtyCancelar` é a QUANTIDADE A SOMAR ao saldo cancelado (delta), não o total.
 */
export function useCancelarSaldoItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      qtyCancelar,
      motivo,
    }: {
      itemId: string;
      qtyCancelar: number;
      motivo: string;
    }) => {
      if (!Number.isFinite(qtyCancelar) || qtyCancelar <= 0) {
        throw new Error("Quantidade a cancelar deve ser maior que zero");
      }
      if (!motivo || motivo.trim().length === 0) {
        throw new Error("Motivo é obrigatório para cancelar saldo");
      }
      const { error } = await supabase.rpc(
        "rpc_china_oc_cancelar_saldo_item" as any,
        {
          p_item_id: itemId,
          p_qty_cancelar: Math.trunc(qtyCancelar),
          p_motivo: motivo.trim(),
        } as any,
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-ordem-itens"] });
      qc.invalidateQueries({ queryKey: ["china-ordens"] });
      toast.success("Saldo cancelado com sucesso");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao cancelar"),
  });
}
