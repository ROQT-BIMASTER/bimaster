import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RepararDocsResult {
  projeto_id: string | null;
  movidos: number;
  tarefas_removidas: number;
  vinculados?: number;
}

/**
 * Reorganiza os documentos de uma submissão já convertida em projeto:
 * move anexos para a tarefa correta do checklist e remove tarefas
 * duplicadas que ficaram vazias. Idempotente.
 */
export function useRepararDocsProjeto() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (submissaoId: string): Promise<RepararDocsResult> => {
      const { data, error } = await supabase.rpc(
        "rpc_china_reparar_documentos_projeto" as any,
        { p_submissao_id: submissaoId },
      );
      if (error) throw error;
      return data as unknown as RepararDocsResult;
    },
    onSuccess: (res) => {
      if (!res?.projeto_id) {
        toast.info("Esta submissão ainda não possui projeto vinculado");
        return;
      }
      if (!res.movidos && !res.tarefas_removidas) {
        toast.success("Documentos já estavam organizados nas tarefas corretas");
      } else {
        toast.success(
          `${res.movidos} documento(s) reorganizados${
            res.tarefas_removidas ? ` — ${res.tarefas_removidas} tarefa(s) duplicada(s) removida(s)` : ""
          }`,
        );
      }
      qc.invalidateQueries({ queryKey: ["china-doc-vinculos"] });
      qc.invalidateQueries({ queryKey: ["china-docs-da-tarefa"] });
      qc.invalidateQueries({ queryKey: ["tarefas-anexos-resumo"] });
      qc.invalidateQueries({ queryKey: ["projeto-tarefas"] });
      qc.invalidateQueries({ queryKey: ["projeto-secoes"] });
    },
    onError: (e: any) => {
      toast.error(e?.message || "Falha ao reorganizar os documentos do projeto");
    },
  });
}
