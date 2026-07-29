import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SincronizarDocsResult {
  projeto_id: string | null;
  vinculados: number;
  tarefas_criadas: number;
}

/**
 * Sincroniza documentos da submissão China que ainda não estão vinculados a
 * tarefas do projeto-espelho. Idempotente: pode ser executada quantas vezes
 * for necessário sem duplicar tarefas ou anexos.
 */
export function useSincronizarDocsProjeto() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (submissaoId: string): Promise<SincronizarDocsResult> => {
      const { data, error } = await supabase.rpc(
        "rpc_china_sincronizar_documentos_projeto" as any,
        { p_submissao_id: submissaoId },
      );
      if (error) throw error;
      return data as unknown as SincronizarDocsResult;
    },
    onSuccess: (res) => {
      if (!res?.projeto_id) {
        toast.info("Esta submissão ainda não possui projeto vinculado");
        return;
      }
      if (!res.vinculados) {
        toast.success("Documentos já estavam sincronizados com o projeto");
      } else {
        toast.success(
          `${res.vinculados} documento(s) vinculados${
            res.tarefas_criadas ? ` — ${res.tarefas_criadas} tarefa(s) criada(s)` : ""
          }`,
        );
      }
      qc.invalidateQueries({ queryKey: ["china-doc-vinculos"] });
      qc.invalidateQueries({ queryKey: ["china-docs-da-tarefa"] });
      qc.invalidateQueries({ queryKey: ["china-docs-submissao"] });
      qc.invalidateQueries({ queryKey: ["projeto-tarefas"] });
      qc.invalidateQueries({ queryKey: ["projeto-secoes"] });
    },
    onError: (e: any) => {
      toast.error(e?.message || "Falha ao sincronizar documentos com o projeto");
    },
  });
}
