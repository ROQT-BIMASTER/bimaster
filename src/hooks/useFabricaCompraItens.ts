import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FabricaCompraItem {
  id: string;
  compra_id: string;
  mp_id: string | null;
  descricao: string | null;
  qty_pedida: number;
  qty_recebida: number;
  qty_cancelada: number;
  preco_unitario: number | null;
  status: "aberto" | "parcial" | "fechado" | "cancelado";
  created_at: string;
  updated_at: string;
}

export function useFabricaCompraItens(compraId?: string) {
  return useQuery({
    queryKey: ["fabrica-compra-itens", compraId],
    enabled: !!compraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_compra_itens" as any)
        .select("*, mp:fabrica_materias_primas(nome, unidade_medida)")
        .eq("compra_id", compraId!);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useCriarCompraItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      compra_id: string;
      mp_id?: string;
      descricao?: string;
      qty_pedida: number;
      preco_unitario?: number;
    }) => {
      const { error } = await supabase.from("fabrica_compra_itens" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fabrica-compra-itens"] });
      toast.success("Item adicionado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar item"),
  });
}

export function useFabricaCompraRecebimentos(compraId?: string) {
  return useQuery({
    queryKey: ["fabrica-compra-recebimentos", compraId],
    enabled: !!compraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_compra_recebimentos" as any)
        .select("*")
        .eq("compra_id", compraId!)
        .order("numero_recebimento", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useRegistrarRecebimentoCompra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      compra_id: string;
      data_recebimento?: string;
      nota_fiscal?: string;
      observacoes?: string;
      itens: Array<{ compra_item_id: string; qty_recebida: number }>;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { count } = await supabase
        .from("fabrica_compra_recebimentos" as any)
        .select("*", { count: "exact", head: true })
        .eq("compra_id", payload.compra_id);

      const { data: receb, error: rErr } = await supabase
        .from("fabrica_compra_recebimentos" as any)
        .insert({
          compra_id: payload.compra_id,
          numero_recebimento: (count || 0) + 1,
          data_recebimento: payload.data_recebimento || new Date().toISOString().slice(0, 10),
          nota_fiscal: payload.nota_fiscal || null,
          observacoes: payload.observacoes || null,
          recebido_por: user?.id,
        } as any)
        .select()
        .single();
      if (rErr) throw rErr;

      const linhas = payload.itens
        .filter((i) => i.qty_recebida > 0)
        .map((i) => ({
          recebimento_id: (receb as any).id,
          compra_item_id: i.compra_item_id,
          qty_recebida: i.qty_recebida,
        }));
      if (linhas.length === 0) throw new Error("Informe ao menos 1 item recebido");

      const { error: iErr } = await supabase
        .from("fabrica_compra_recebimento_itens" as any)
        .insert(linhas as any);
      if (iErr) throw iErr;
      return receb;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fabrica-compra-itens"] });
      qc.invalidateQueries({ queryKey: ["fabrica-compra-recebimentos"] });
      qc.invalidateQueries({ queryKey: ["compras-pendencias"] });
      toast.success("Recebimento registrado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar recebimento"),
  });
}
