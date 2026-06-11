import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface CriarArgs {
  submissaoId: string;
  /** Se informado, vincula à um projeto existente em vez de criar um novo. */
  projetoId?: string | null;
  /** Template do checklist Brasil → China a popular automaticamente. */
  templateB2cId?: string | null;
  projetoNome?: string | null;
  secaoNome?: string;
}

interface CriarResult {
  projeto_id: string;
  submissao_id: string;
  secao_id?: string;
  created: boolean;
  already_existed: boolean;
}

export function useCriarProjetoEspelho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CriarArgs): Promise<CriarResult> => {
      const { data, error } = await supabase.rpc("rpc_china_criar_projeto_espelho" as any, {
        p_submissao_id: args.submissaoId,
        p_projeto_id: args.projetoId ?? null,
        p_template_b2c_id: args.templateB2cId ?? null,
        p_secao_nome: args.secaoNome ?? "Documentos da Submissão",
        p_projeto_nome: args.projetoNome ?? null,
      });
      if (error) throw error;
      return data as unknown as CriarResult;
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
