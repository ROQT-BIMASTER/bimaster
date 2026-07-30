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

/* ─────────── Aprovação em lote ─────────── */

export interface DecisaoLoteParams {
  documentoIds: string[];
  decisao: "aprovado" | "rejeitado";
  senha: string;
  parecer?: string;
  projetoId?: string | null;
  origem?: string;
}

export interface DecisaoLoteResultado {
  ok: boolean;
  lote_id: string;
  processados: number;
  falhas: number;
  erros: Array<{ documento_id: string; erro: string }>;
}

/**
 * Aprova/reprova vários documentos com um único step-up de senha.
 * O servidor grava uma trilha homologada separada por documento.
 */
export function useDecisaoLoteHomologada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: DecisaoLoteParams): Promise<DecisaoLoteResultado> => {
      if (!params.senha?.trim()) throw new Error("Confirme sua senha para homologar as decisões.");
      if (params.documentoIds.length === 0) throw new Error("Selecione ao menos um documento.");
      const { token } = await requestStepUpWithPassword(CHINA_DOC_APPROVAL_SCOPE, params.senha);
      const { data, error } = await supabase.rpc("rpc_china_aprovar_documentos_lote" as any, {
        p_documento_ids: params.documentoIds,
        p_decisao: params.decisao,
        p_step_up_token: token,
        p_parecer: params.parecer?.trim() || null,
        p_projeto_id: params.projetoId || null,
        p_origem: params.origem || "kanban_lote",
        p_metodo: "senha",
      } as any);
      if (error) throw error;
      return data as unknown as DecisaoLoteResultado;
    },
    onSuccess: (res, vars) => {
      invalidateDocQueries(qc);
      qc.invalidateQueries({ queryKey: ["projeto-china-docs"] });
      const verbo = vars.decisao === "aprovado" ? "aprovado(s)" : "marcado(s) como não aprovado(s)";
      toast.success(`${res.processados} documento(s) ${verbo} com trilha homologada.`);
      if (res.falhas > 0) toast.error(`${res.falhas} documento(s) não puderam ser processados.`);
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao homologar o lote."),
  });
}

/* ─────────── Mudança de situação em lote (sem step-up) ─────────── */

export interface StatusLoteParams {
  documentoIds: string[];
  status: "em_analise" | "pendente";
  projetoId?: string | null;
  origem?: string;
}

/**
 * Atualiza a situação (Em análise / Pendente de aprovação) de vários documentos.
 * Cada documento é processado individualmente pela rotina auditada; falhas
 * isoladas não abortam o lote.
 */
export function useStatusLoteDocumentos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: StatusLoteParams) => {
      if (params.documentoIds.length === 0) throw new Error("Selecione ao menos um documento.");
      let ok = 0;
      const erros: Array<{ documento_id: string; erro: string }> = [];
      for (const documentoId of params.documentoIds) {
        const { error } = await supabase.rpc("rpc_china_definir_status_documento" as any, {
          p_documento_id: documentoId,
          p_status: params.status,
          p_tarefa_id: null,
          p_projeto_id: params.projetoId || null,
          p_origem: params.origem || "kanban_lote",
        } as any);
        if (error) erros.push({ documento_id: documentoId, erro: error.message });
        else ok += 1;
      }
      return { processados: ok, falhas: erros.length, erros };
    },
    onSuccess: (res, vars) => {
      invalidateDocQueries(qc);
      qc.invalidateQueries({ queryKey: ["projeto-china-docs"] });
      const alvo =
        vars.status === "em_analise" ? "em análise" : "pendente(s) de aprovação";
      toast.success(`${res.processados} documento(s) atualizado(s) para ${alvo}.`);
      if (res.falhas > 0) toast.error(`${res.falhas} documento(s) não puderam ser atualizados.`);
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao atualizar a situação em lote."),
  });
}

export interface ProjetoChinaDoc {
  documento_id: string;
  tarefa_id: string;
  tarefa_titulo: string | null;
  nome_arquivo: string | null;
  tipo_documento: string;
  status: string;
  created_at: string | null;
  oficializado_em: string | null;
  assinado_em: string | null;
  previsao_envio: string | null;
}

/** Documentos da submissão China vinculados às tarefas de um projeto. */
export function useProjetoChinaDocs(projetoId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["projeto-china-docs", projetoId],
    enabled: !!projetoId && enabled,
    queryFn: async (): Promise<ProjetoChinaDoc[]> => {
      const { data: vinculos, error } = await (supabase
        .from("china_documento_tarefa_vinculos" as any)
        .select("documento_id, tarefa_id")
        .eq("projeto_id", projetoId!)
        .limit(500) as any);
      if (error) throw error;
      const list = (vinculos || []) as Array<{ documento_id: string; tarefa_id: string }>;
      if (list.length === 0) return [];

      const docIds = [...new Set(list.map((v) => v.documento_id))];
      const tarefaIds = [...new Set(list.map((v) => v.tarefa_id))];

      const [docsRes, tarefasRes] = await Promise.all([
        supabase
          .from("china_produto_documentos")
          .select(
            "id, nome_arquivo, tipo_documento, status, created_at, oficializado_em, assinado_em, previsao_envio",
          )
          .in("id", docIds),
        supabase.from("projeto_tarefas").select("id, titulo").in("id", tarefaIds),
      ]);

      const docMap = new Map(((docsRes.data || []) as any[]).map((d) => [d.id, d]));
      const tarefaMap = new Map(((tarefasRes.data || []) as any[]).map((t) => [t.id, t.titulo]));

      const vistos = new Set<string>();
      const out: ProjetoChinaDoc[] = [];
      for (const v of list) {
        if (vistos.has(v.documento_id)) continue;
        const d = docMap.get(v.documento_id);
        if (!d) continue;
        vistos.add(v.documento_id);
        out.push({
          documento_id: d.id,
          tarefa_id: v.tarefa_id,
          tarefa_titulo: tarefaMap.get(v.tarefa_id) ?? null,
          nome_arquivo: d.nome_arquivo,
          tipo_documento: d.tipo_documento,
          status: d.status,
          created_at: d.created_at ?? null,
          oficializado_em: d.oficializado_em ?? null,
          assinado_em: d.assinado_em ?? null,
          previsao_envio: d.previsao_envio ?? null,
        });
      }
      return out;
    },
  });
}

