import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface VinculoInternacional {
  id: string;
  china_ordem_compra_id: string;
  china_ordem_item_id: string | null;
  fabrica_op_id: string | null;
  fabrica_compra_id: string | null;
  fabrica_mp_id: string | null;
  qty_alocada: number;
  observacoes: string | null;
  created_at: string;
  fabrica_op?: { numero: string; status: string } | null;
  fabrica_compra?: { id: string; nota_fiscal: string | null } | null;
  fabrica_mp?: { nome: string } | null;
}

export function useVinculosPorOC(ocId?: string) {
  return useQuery({
    queryKey: ["civ-por-oc", ocId],
    enabled: !!ocId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras_internacional_vinculos" as any)
        .select(
          "*, fabrica_op:fabrica_ordens_producao(numero, status), fabrica_compra:fabrica_compras(id, nota_fiscal), fabrica_mp:fabrica_materias_primas(nome)",
        )
        .eq("china_ordem_compra_id", ocId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as VinculoInternacional[];
    },
  });
}

export function useVinculosPorOP(opId?: string) {
  return useQuery({
    queryKey: ["civ-por-op", opId],
    enabled: !!opId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras_internacional_vinculos" as any)
        .select("*, china_oc:china_ordens_compra(numero_oc, produto_nome)")
        .eq("fabrica_op_id", opId!);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useCriarVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      china_ordem_compra_id: string;
      china_ordem_item_id?: string;
      fabrica_op_id?: string;
      fabrica_compra_id?: string;
      fabrica_mp_id?: string;
      qty_alocada: number;
      observacoes?: string;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase.from("compras_internacional_vinculos" as any).insert({
        ...payload,
        created_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["civ-por-oc"] });
      qc.invalidateQueries({ queryKey: ["civ-por-op"] });
      toast.success("Vínculo Brasil ↔ China criado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao vincular"),
  });
}

export function useRemoverVinculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("compras_internacional_vinculos" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["civ-por-oc"] });
      qc.invalidateQueries({ queryKey: ["civ-por-op"] });
      toast.success("Vínculo removido");
    },
  });
}
