import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectService, type CreateFromSubmissionResult } from "@/lib/projetos/projectService";
import type { ProjectCreateOpts } from "@/lib/projetos/projectCreateOpts";

/**
 * Resolve o projeto-espelho (is_espelho=true) de uma submissão China,
 * se existir. Usado pela aba "Submissão China" do projeto e pelo botão
 * "Continuar no projeto" da Mesa China.
 */
export function useProjetoEspelhoDaSubmissao(submissaoId: string | null | undefined) {
  return useQuery({
    queryKey: ["china-projeto-espelho", "submissao", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_submissao_projetos")
        .select("projeto_id, submissao_id, is_espelho")
        .eq("submissao_id", submissaoId!)
        .eq("is_espelho", true)
        .maybeSingle();
      if (error) throw error;
      return data as { projeto_id: string; submissao_id: string; is_espelho: boolean } | null;
    },
  });
}

/**
 * Inverso: dado um projeto-espelho (tipo='china_submissao'),
 * recupera a submissão China que o originou.
 */
export function useSubmissaoDoProjetoEspelho(projetoId: string | null | undefined) {
  return useQuery({
    queryKey: ["china-projeto-espelho", "projeto", projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_submissao_projetos")
        .select("submissao_id, projeto_id, is_espelho")
        .eq("projeto_id", projetoId!)
        .eq("is_espelho", true)
        .maybeSingle();
      if (error) throw error;
      return data as { submissao_id: string; projeto_id: string; is_espelho: boolean } | null;
    },
  });
}

/**
 * Compatibilidade retro: o tipo legado `CriarProjetoEspelhoConfig` agora é
 * apenas um alias do `ProjectCreateOpts` compartilhado. Mantido para não
 * quebrar imports existentes — prefira `ProjectCreateOpts` em código novo.
 */
export type CriarProjetoEspelhoConfig = ProjectCreateOpts;

export interface CriarProjetoEspelhoArgs extends ProjectCreateOpts {
  submissaoId: string;
  /** Se informado, vincula a um projeto existente em vez de criar um novo. */
  projetoId?: string | null;
}

export type CriarProjetoEspelhoResult = CreateFromSubmissionResult;

export function useCriarProjetoEspelho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CriarProjetoEspelhoArgs): Promise<CriarProjetoEspelhoResult> => {
      const { submissaoId, projetoId, ...opts } = args;
      // Fonte única de opts: o mesmo `ProjectCreateOpts` flui sem
      // remapeamento manual para `ProjectService` (Fase 12).
      return projetoId
        ? ProjectService.linkExisting(submissaoId, projetoId, opts)
        : ProjectService.createFromSubmission(submissaoId, opts);
    },
    onSuccess: (res) => {
      toast.success(
        res.already_existed
          ? "Projeto-espelho já existia — abrindo"
          : res.created
            ? "Projeto-espelho criado"
            : "Submissão vinculada ao projeto",
      );
      qc.invalidateQueries({ queryKey: ["china-projeto-espelho"] });
      qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
      qc.invalidateQueries({ queryKey: ["projetos"] });
    },
    onError: (e: any) => {
      toast.error(e?.message || "Falha ao criar projeto-espelho");
    },
  });
}

