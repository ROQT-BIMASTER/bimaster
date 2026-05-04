import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LovablePlan {
  id: string;
  plano: string;
  creditos_mensais: number;
  custo_mensal_brl: number;
  vigente_desde: string;
  vigente_ate: string | null;
  observacao: string | null;
  taxa_brl_por_credito: number;
}

export function useLovablePlanConfig() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["lovable-plan-config"],
    queryFn: async (): Promise<LovablePlan[]> => {
      const { data, error } = await supabase
        .from("lovable_plan_config")
        .select("*")
        .order("vigente_desde", { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        taxa_brl_por_credito:
          p.creditos_mensais > 0 ? Number(p.custo_mensal_brl) / p.creditos_mensais : 0,
      }));
    },
    staleTime: 60_000,
  });

  const planoVigente = (query.data || []).find(
    (p) => !p.vigente_ate || new Date(p.vigente_ate) >= new Date()
  );

  const upsert = useMutation({
    mutationFn: async (input: {
      id?: string;
      plano: string;
      creditos_mensais: number;
      custo_mensal_brl: number;
      vigente_desde: string;
      vigente_ate: string | null;
      observacao: string | null;
    }) => {
      const { id, ...rest } = input;
      if (id) {
        const { error } = await supabase.from("lovable_plan_config").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lovable_plan_config").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lovable-plan-config"] });
      toast.success("Plano salvo");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar plano"),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lovable_plan_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lovable-plan-config"] });
      toast.success("Plano removido");
    },
  });

  return { ...query, planoVigente, upsert, remover };
}
