/**
 * Decisões administrativas sobre documentos da submissão China.
 *
 * - Aprovação / reprovação exigem confirmação de senha (step-up token
 *   validado no servidor) e geram registro homologado em
 *   `china_doc_aprovacoes_audit` com autor, método, data e hora.
 * - Estados intermediários (em análise / pendente) usam a rotina simples,
 *   também auditada.
 *
 * O status atualizado reflete em todos os ambientes que leem
 * `china_produto_documentos` (Módulo China, Vincular China, Kanban, Projeto).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CHINA_DOC_APPROVAL_SCOPE,
  requestStepUpWithPassword,
} from "@/lib/security/stepUpPassword";

function invalidateDocQueries(qc: ReturnType<typeof useQueryClient>) {
  [
    "china-docs-da-tarefa",
    "china-ficha-docs",
    "china-revisoes",
    "china-mailbox-dataset",
    "china-inbox",
    "tarefas-anexos-resumo",
    "tarefas-doc-status",
    "china-doc-aprovacoes",
    "china-produto-documentos",
  ].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
}

export interface DecisaoHomologadaParams {
  documentoId: string;
  decisao: "aprovado" | "rejeitado";
  senha: string;
  parecer?: string;
  tarefaId?: string | null;
  projetoId?: string | null;
  origem?: string;
}

export function useDecisaoHomologada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: DecisaoHomologadaParams) => {
      if (!params.senha?.trim()) throw new Error("Confirme sua senha para homologar a decisão.");
      const { token } = await requestStepUpWithPassword(
        CHINA_DOC_APPROVAL_SCOPE,
        params.senha,
      );
      const { data, error } = await supabase.rpc("rpc_china_aprovar_documento" as any, {
        p_documento_id: params.documentoId,
        p_decisao: params.decisao,
        p_step_up_token: token,
        p_parecer: params.parecer?.trim() || null,
        p_tarefa_id: params.tarefaId || null,
        p_projeto_id: params.projetoId || null,
        p_origem: params.origem || "kanban",
        p_metodo: "senha",
      } as any);
      if (error) throw error;
      return data as any;
    },
    onSuccess: (_data, vars) => {
      invalidateDocQueries(qc);
      toast.success(
        vars.decisao === "aprovado"
          ? "Documento aprovado e registrado na trilha de homologação."
          : "Documento marcado como não aprovado e registrado na trilha.",
      );
    },
    onError: (e: any) =>
      toast.error(e?.message || "Falha ao registrar a decisão."),
  });
}

export function useDefinirStatusDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      documentoId: string;
      status: "em_analise" | "pendente";
      tarefaId?: string | null;
      projetoId?: string | null;
      origem?: string;
    }) => {
      const { error } = await supabase.rpc("rpc_china_definir_status_documento" as any, {
        p_documento_id: params.documentoId,
        p_status: params.status,
        p_tarefa_id: params.tarefaId || null,
        p_projeto_id: params.projetoId || null,
        p_origem: params.origem || "kanban",
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      invalidateDocQueries(qc);
      toast.success(
        vars.status === "em_analise"
          ? "Documento marcado como em análise."
          : "Documento voltou para pendente de aprovação.",
      );
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao atualizar o status."),
  });
}

export interface DocAprovacaoAudit {
  id: string;
  decisao: string;
  parecer: string | null;
  decidido_por_nome: string | null;
  decidido_por_email: string | null;
  metodo_confirmacao: string;
  origem: string | null;
  created_at: string;
}

export function useDocAprovacoesAudit(documentoId: string | undefined) {
  return useQuery({
    queryKey: ["china-doc-aprovacoes", documentoId],
    enabled: !!documentoId,
    queryFn: async (): Promise<DocAprovacaoAudit[]> => {
      const { data, error } = await (supabase
        .from("china_doc_aprovacoes_audit" as any)
        .select(
          "id, decisao, parecer, decidido_por_nome, decidido_por_email, metodo_confirmacao, origem, created_at",
        )
        .eq("documento_id", documentoId!)
        .order("created_at", { ascending: false })
        .limit(50) as any);
      if (error) throw error;
      return (data || []) as DocAprovacaoAudit[];
    },
  });
}
