import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EstimativaIA {
  tarefa_id: string;
  horas: number;
  justificativa: string;
  tarefa: {
    id: string;
    titulo: string;
    descricao: string | null;
    prioridade: string | null;
    data_inicio: string | null;
    data_conclusao: string | null;
    responsavel_nome: string | null;
  };
}

export function useEstimarHorasIA(projetoId: string | null) {
  return useMutation({
    mutationFn: async (): Promise<EstimativaIA[]> => {
      if (!projetoId) throw new Error("Sem projeto");
      const { data, error } = await supabase.functions.invoke("projeto-estimar-horas-historico", {
        body: { projeto_id: projetoId },
      });
      if (error) throw error;
      return (data?.estimativas || []) as EstimativaIA[];
    },
    onError: (e: any) => toast.error("Erro IA: " + e.message),
  });
}
