import { supabase } from "@/integrations/supabase/client";
import {
  buildRpcParams,
  type ProjectCreateOpts,
} from "@/lib/projetos/projectCreateOpts";
import { loadConversaoEstrutura } from "@/lib/china/buildConversaoEstrutura";

/**
 * Garante que `opts.estrutura` esteja preenchida — quando o caller não
 * informa, busca do checklist mergeado da submissão. Mantém a hierarquia
 * categoria→tarefa em todos os fluxos de conversão.
 */
async function withEstrutura(
  submissaoId: string,
  opts: ProjectCreateOpts,
): Promise<ProjectCreateOpts> {
  if (opts.estrutura !== undefined) return opts;
  try {
    const estrutura = await loadConversaoEstrutura(submissaoId);
    return { ...opts, estrutura: estrutura.length > 0 ? estrutura : null };
  } catch {
    // Em falha, deixa null → RPC cai no modo legado em vez de quebrar a conversão.
    return { ...opts, estrutura: null };
  }
}

/**
 * Serviço único para criar/sincronizar Projetos a partir de Submissões China.
 *
 * Fonte única de verdade: ambos os fluxos (Fluxo 1 — Ficha do Produto,
 * Fluxo 2 — Mesa China) devem rotear por aqui. Os parâmetros aceitos são
 * o tipo compartilhado `ProjectCreateOpts` de `./projectCreateOpts.ts`.
 *
 * Regra de ouro: NUNCA escrever em `china_submissao_projetos` sem antes
 * chamar `findBySubmission` para garantir idempotência.
 */

export interface SubmissionLink {
  projeto_id: string;
  submissao_id: string;
  is_espelho: boolean;
}

export type CreateFromSubmissionResult = {
  projeto_id: string;
  submissao_id: string;
  secao_id?: string;
  created: boolean;
  already_existed: boolean;
};

export const ProjectService = {
  /**
   * Retorna o projeto-espelho da submissão se existir, senão o primeiro
   * vínculo qualquer. Use isto antes de qualquer create para evitar
   * duplicação.
   */
  async findBySubmission(submissaoId: string): Promise<SubmissionLink | null> {
    if (!submissaoId) return null;

    const espelho = await supabase
      .from("china_submissao_projetos")
      .select("projeto_id, submissao_id, is_espelho")
      .eq("submissao_id", submissaoId)
      .eq("is_espelho", true)
      .maybeSingle();
    if (espelho.error) throw espelho.error;
    if (espelho.data) return espelho.data as SubmissionLink;

    const any = await supabase
      .from("china_submissao_projetos")
      .select("projeto_id, submissao_id, is_espelho")
      .eq("submissao_id", submissaoId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (any.error) throw any.error;
    return (any.data as SubmissionLink | null) ?? null;
  },

  /**
   * Cria ou recupera o projeto da submissão via RPC unificada
   * (`rpc_china_criar_projeto_espelho`). Idempotente.
   */
  async createFromSubmission(
    submissaoId: string,
    opts: ProjectCreateOpts = {},
  ): Promise<CreateFromSubmissionResult> {
    if (!submissaoId) throw new Error("submissaoId é obrigatório");
    const { data, error } = await supabase.rpc(
      "rpc_china_criar_projeto_espelho" as any,
      buildRpcParams(submissaoId, null, opts),
    );
    if (error) throw error;
    return data as CreateFromSubmissionResult;
  },

  /**
   * Vincula a submissão a um projeto JÁ existente. Idempotente.
   * Aceita o mesmo `ProjectCreateOpts` de `createFromSubmission`.
   */
  async linkExisting(
    submissaoId: string,
    projetoId: string,
    opts: ProjectCreateOpts = {},
  ): Promise<CreateFromSubmissionResult> {
    if (!submissaoId) throw new Error("submissaoId é obrigatório");
    if (!projetoId) throw new Error("projetoId é obrigatório");
    const { data, error } = await supabase.rpc(
      "rpc_china_criar_projeto_espelho" as any,
      buildRpcParams(submissaoId, projetoId, opts),
    );
    if (error) throw error;
    return data as CreateFromSubmissionResult;
  },
};
