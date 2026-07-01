import { toFriendlyPermissionMessage } from "@/lib/utils/permissionErrors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useRecebimentosPorOC(ordemId?: string) {
  return useQuery({
    queryKey: ["china-recebimentos-oc", ordemId],
    enabled: !!ordemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_recebimentos_carga" as any)
        .select("*, itens:china_recebimento_itens(*)")
        .eq("ordem_compra_id", ordemId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useTodosRecebimentos() {
  return useQuery({
    queryKey: ["china-recebimentos-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_recebimentos_carga" as any)
        .select("*, oc:china_ordens_compra(numero_oc, produto_codigo, produto_nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useCriarRecebimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      ordem_compra_id: string;
      embarque_id?: string;
      numero_di?: string;
      data_chegada_porto?: string;
      data_desembaraco?: string;
      data_recebimento_cd?: string;
      itens: Array<{
        ordem_item_id: string;
        qty_esperada: number;
        qty_recebida: number;
        qty_avariada?: number;
        qty_faltante?: number;
        motivo_divergencia?: string;
      }>;
      observacoes?: string;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const temDivergencia = payload.itens.some(
        (i) =>
          (i.qty_recebida || 0) !== (i.qty_esperada || 0) ||
          (i.qty_avariada || 0) > 0 ||
          (i.qty_faltante || 0) > 0,
      );

      const { data: receb, error } = await supabase
        .from("china_recebimentos_carga" as any)
        .insert({
          ordem_compra_id: payload.ordem_compra_id,
          embarque_id: payload.embarque_id || null,
          numero_di: payload.numero_di || null,
          data_chegada_porto: payload.data_chegada_porto || null,
          data_desembaraco: payload.data_desembaraco || null,
          data_recebimento_cd: payload.data_recebimento_cd || null,
          conferente_id: user?.id,
          status: temDivergencia ? "divergente" : "recebido",
          observacoes: payload.observacoes || null,
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) throw error;

      const linhas = payload.itens.map((i) => ({
        recebimento_id: (receb as any).id,
        ordem_item_id: i.ordem_item_id,
        qty_esperada: i.qty_esperada,
        qty_recebida: i.qty_recebida,
        qty_avariada: i.qty_avariada || 0,
        qty_faltante: i.qty_faltante || 0,
        motivo_divergencia: i.motivo_divergencia || null,
      }));

      const { error: iErr } = await supabase
        .from("china_recebimento_itens" as any)
        .insert(linhas as any);
      if (iErr) throw iErr;

      return receb;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["china-recebimentos-oc"] });
      qc.invalidateQueries({ queryKey: ["china-recebimentos-all"] });
      qc.invalidateQueries({ queryKey: ["china-ordem-itens"] });
      qc.invalidateQueries({ queryKey: ["china-nao-conformidades"] });
      toast.success("Recebimento registrado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar recebimento"),
  });
}
