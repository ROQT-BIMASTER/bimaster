import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GerarOPInput {
  oc_id: string;
  produto_id: string;
  qty: number;
  formula_id?: string | null;
  lote?: string | null;
  data_prevista?: string | null;
  maquina_id?: string | null;
  responsavel_id?: string | null;
  obs?: string | null;
}

export function useGerarOPDaOC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GerarOPInput) => {
      const { data, error } = await supabase.rpc("rpc_gerar_op_da_oc_china" as any, {
        p_oc_id: input.oc_id,
        p_produto_id: input.produto_id,
        p_qty: input.qty,
        p_formula_id: input.formula_id ?? null,
        p_lote: input.lote ?? null,
        p_data_prevista: input.data_prevista ?? null,
        p_maquina_id: input.maquina_id ?? null,
        p_responsavel_id: input.responsavel_id ?? null,
        p_obs: input.obs ?? null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
      return row as { op_id: string; numero: string };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["fabrica-op-da-oc", vars.oc_id] });
      qc.invalidateQueries({ queryKey: ["china-oc-recebimento-kpis"] });
      toast.success(`Ordem de Produção ${_d.numero} gerada / 生产单已生成`);
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao gerar OP"),
  });
}

export function useVincularOPExistente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { oc_id: string; op_id: string; qty?: number; obs?: string }) => {
      const { data, error } = await supabase.rpc("rpc_vincular_op_existente" as any, {
        p_oc_id: input.oc_id,
        p_op_id: input.op_id,
        p_qty: input.qty ?? null,
        p_obs: input.obs ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["fabrica-op-da-oc", v.oc_id] });
      toast.success("Ordem de Produção vinculada / 已关联生产单");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao vincular"),
  });
}

export function useDesvincularOP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vinculo_id: string) => {
      const { error } = await supabase.rpc("rpc_desvincular_op_da_oc" as any, {
        p_vinculo_id: vinculo_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fabrica-op-da-oc"] });
      toast.success("Vínculo removido / 关联已解除");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao desvincular"),
  });
}
