import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface HandoffAlerta {
  id: string;
  processo_id: string;
  ligacao_id: string;
  de_etapa_id: string;
  para_etapa_id: string;
  data_ref: string;
  tipo: "origem_atrasada" | "handoff_estourado";
  minutos_atraso: number | null;
  gerado_em: string;
  resolvido_em: string | null;
  escalado_em: string | null;
}

/** Alertas ativos do processo no dia. */
export function useHandoffAlertas(processoId: string | null | undefined, dataRef?: string) {
  return useQuery({
    enabled: !!processoId,
    queryKey: ["processo", "handoff-alertas", processoId, dataRef ?? "hoje"],
    refetchInterval: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("processo_handoff_alertas" as any)
        .select("*")
        .eq("processo_id", processoId!)
        .order("gerado_em", { ascending: false });
      if (dataRef) q = q.eq("data_ref", dataRef);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as HandoffAlerta[];
    },
  });
}

/** Dispara varredura imediata (útil quando o líder acabou de agir e quer refresh). */
export function useGerarAlertasHandoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_processo_gerar_alertas_handoff" as any, {});
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processo", "handoff-alertas"] });
      qc.invalidateQueries({ queryKey: ["processo", "execucao-dia"] });
      toast.success("Alertas atualizados.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao gerar alertas."),
  });
}

export function useResolverAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("processo_handoff_alertas" as any)
        .update({ resolvido_em: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processo", "handoff-alertas"] });
      toast.success("Alerta marcado como resolvido.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao resolver alerta."),
  });
}

export function useEscalarAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("rpc_processo_escalar_alerta" as any, { _alerta_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["processo", "handoff-alertas"] });
      toast.success("Alerta escalado para líderes.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao escalar."),
  });
}
