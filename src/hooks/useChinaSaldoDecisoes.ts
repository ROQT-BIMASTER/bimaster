import { toFriendlyPermissionMessage } from "@/lib/utils/permissionErrors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DecisaoSaldo = "manter_aberta" | "fechar_parcial" | "cancelar_saldo" | "gerar_nova_oc";

export function useSaldoDecisoes(ordemId?: string) {
  return useQuery({
    queryKey: ["china-saldo-decisoes", ordemId],
    enabled: !!ordemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_oc_saldo_decisoes" as any)
        .select("*")
        .eq("ordem_compra_id", ordemId!)
        .order("decidido_em", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useRegistrarDecisaoSaldo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ordem_compra_id: string;
      ordem_item_id?: string;
      qty_remanescente: number;
      decisao: DecisaoSaldo;
      justificativa?: string;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      let nova_oc_id: string | null = null;

      // Se gerar_nova_oc, cria nova OC com saldo
      if (payload.decisao === "gerar_nova_oc") {
        const { data: ocAtual } = await supabase
          .from("china_ordens_compra" as any)
          .select("*")
          .eq("id", payload.ordem_compra_id)
          .single();

        const year = new Date().getFullYear();
        const { count } = await supabase
          .from("china_ordens_compra" as any)
          .select("*", { count: "exact", head: true });
        const numeroOC = `OC-${year}-${String((count || 0) + 1).padStart(3, "0")}-R`;

        const { data: novaOc, error: nErr } = await supabase
          .from("china_ordens_compra" as any)
          .insert({
            numero_oc: numeroOC,
            submissao_id: (ocAtual as any).submissao_id,
            produto_codigo: (ocAtual as any).produto_codigo,
            produto_nome: (ocAtual as any).produto_nome,
            qty_total: payload.qty_remanescente,
            data_entrega_prevista: (ocAtual as any).data_entrega_prevista,
            ean_caixa_master: (ocAtual as any).ean_caixa_master,
            observacoes: `Saldo da OC ${(ocAtual as any).numero_oc}. ${payload.justificativa || ""}`,
            status: "rascunho",
            created_by: user?.id,
          } as any)
          .select()
          .single();
        if (nErr) throw nErr;
        nova_oc_id = (novaOc as any).id;
      }

      // Se cancelar_saldo, cancela o item
      if (payload.decisao === "cancelar_saldo" && payload.ordem_item_id) {
        const { data: item } = await supabase
          .from("china_ordem_itens" as any)
          .select("qty_pedida, qty_recebida, qty_embarcada, qty_produzida")
          .eq("id", payload.ordem_item_id)
          .single();
        if (item) {
          const realizadas = Math.max(
            (item as any).qty_recebida,
            (item as any).qty_embarcada,
            (item as any).qty_produzida,
          );
          const cancelar = (item as any).qty_pedida - realizadas;
          await supabase
            .from("china_ordem_itens" as any)
            .update({ qty_cancelada: cancelar } as any)
            .eq("id", payload.ordem_item_id);
        }
      }

      // Se fechar_parcial, marca item como cancelado para o saldo
      if (payload.decisao === "fechar_parcial" && payload.ordem_item_id) {
        const { data: item } = await supabase
          .from("china_ordem_itens" as any)
          .select("qty_pedida, qty_recebida")
          .eq("id", payload.ordem_item_id)
          .single();
        if (item) {
          await supabase
            .from("china_ordem_itens" as any)
            .update({ qty_cancelada: (item as any).qty_pedida - (item as any).qty_recebida } as any)
            .eq("id", payload.ordem_item_id);
        }
      }

      const { error } = await supabase.from("china_oc_saldo_decisoes" as any).insert({
        ordem_compra_id: payload.ordem_compra_id,
        ordem_item_id: payload.ordem_item_id || null,
        qty_remanescente: payload.qty_remanescente,
        decisao: payload.decisao,
        nova_oc_id,
        justificativa: payload.justificativa || null,
        decidido_por: user?.id,
      } as any);
      if (error) throw error;
      return { nova_oc_id };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["china-saldo-decisoes"] });
      qc.invalidateQueries({ queryKey: ["china-ordem-itens"] });
      qc.invalidateQueries({ queryKey: ["china-ordens"] });
      toast.success(
        data.nova_oc_id ? "Decisão registrada — nova OC criada com o saldo" : "Decisão registrada",
      );
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar decisão"),
  });
}
