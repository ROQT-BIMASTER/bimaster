import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface AITask {
  titulo: string;
  descricao?: string;
  secao_id?: string;
  secao_nome?: string;
  prioridade: string;
  estagio?: string;
  data_prazo?: string;
  produto_mencionado?: string;
}

interface AISecao {
  nome: string;
}

interface CreateResult {
  secoes: AISecao[];
  tasks: AITask[];
}

interface SuggestFieldsResult {
  descricao: string;
  prioridade: string;
  estagio: string;
  dias_prazo_sugerido: number;
}

interface ChecklistResult {
  items: { titulo: string; ordem: number }[];
}

interface ProjectSummaryResult {
  summary: string;
  stats?: {
    total: number;
    concluidas: number;
    atrasadas: number;
    semResponsavel: number;
    altaPrioridade: number;
  };
}

interface ClassifyDocumentResult {
  categoria: string;
  confianca: number;
}

async function callProjetoIA<T>(action: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("projeto-ia-assistant", {
    body: { action, ...params },
  });

  if (error) {
    console.error("[useProjetoIA] error:", error);
    throw new Error(error.message || "Erro ao chamar assistente de IA");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}

export function useProjetoIA() {
  const [loading, setLoading] = useState<string | null>(null);

  const createTasksWithAI = async (
    prompt: string,
    projetoId: string,
    secoes: { id: string; nome: string }[],
    createType = "tarefas"
  ): Promise<CreateResult> => {
    setLoading("create_tasks");
    try {
      const result = await callProjetoIA<CreateResult>("create_tasks", {
        prompt,
        projetoId,
        secoes,
        createType,
      });
      return { secoes: result.secoes || [], tasks: result.tasks || [] };
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar com IA");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  const createFromFile = async (
    fileContent: string,
    fileType: string,
    projetoId: string,
    secoes: { id: string; nome: string }[],
    createType = "ambos",
    prompt?: string
  ): Promise<CreateResult> => {
    setLoading("create_from_file");
    try {
      const result = await callProjetoIA<CreateResult>("create_from_file", {
        fileContent,
        fileType,
        createType,
        projetoId,
        secoes,
        prompt,
      });
      return { secoes: result.secoes || [], tasks: result.tasks || [] };
    } catch (err: any) {
      toast.error(err.message || "Erro ao interpretar arquivo");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  const suggestFields = async (
    titulo: string,
    descricao: string | null,
    projetoNome: string,
    secaoNome: string
  ): Promise<SuggestFieldsResult> => {
    setLoading("suggest_fields");
    try {
      return await callProjetoIA<SuggestFieldsResult>("suggest_fields", {
        titulo, descricao, projetoNome, secaoNome,
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao sugerir preenchimento");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  const generateChecklist = async (
    titulo: string,
    descricao: string | null,
    estagio: string | null
  ): Promise<ChecklistResult> => {
    setLoading("generate_checklist");
    try {
      return await callProjetoIA<ChecklistResult>("generate_checklist", {
        titulo, descricao, estagio,
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar checklist");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  const getProjectSummary = async (projetoId: string): Promise<ProjectSummaryResult> => {
    setLoading("project_summary");
    try {
      return await callProjetoIA<ProjectSummaryResult>("project_summary", { projetoId });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar resumo");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  const classifyDocument = async (
    fileName: string,
    tipoArquivo: string | null
  ): Promise<ClassifyDocumentResult> => {
    setLoading("classify_document");
    try {
      return await callProjetoIA<ClassifyDocumentResult>("classify_document", {
        fileName, tipoArquivo,
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao classificar documento");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  const generateSubtasks = async (
    tarefaTitulo: string,
    tarefaDescricao: string | null,
    estagio: string | null,
    projetoNome: string | null,
    qtdSugerida = 5
  ): Promise<{ subtarefas: { titulo: string; descricao?: string; ordem: number }[] }> => {
    setLoading("generate_subtasks");
    try {
      return await callProjetoIA("generate_subtasks", {
        tarefaTitulo, tarefaDescricao, estagio, projetoNome, qtdSugerida,
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar subtarefas");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  const refineDescription = async (
    titulo: string,
    descricaoAtual: string | null,
    estagio: string | null,
    projetoNome: string | null
  ): Promise<{ descricao: string }> => {
    setLoading("refine_description");
    try {
      return await callProjetoIA("refine_description", {
        titulo, descricaoAtual, estagio, projetoNome,
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao refinar descrição");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  const metasDiagnostico = async (projetoId: string): Promise<{ summary: string }> => {
    setLoading("metas_diagnostico");
    try {
      return await callProjetoIA("metas_diagnostico", { projetoId });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar diagnóstico");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  const metasPlanoAcao = async (
    metaId: string,
    projetoId: string,
  ): Promise<{ resumo: string; etapas: { titulo: string; descricao: string; prazo_dias: number; criticidade: string }[] }> => {
    setLoading("metas_plano_acao");
    try {
      return await callProjetoIA("metas_plano_acao", { metaId, projetoId });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar plano de ação");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  const metasPautaReuniao = async (projetoId: string): Promise<{ pauta: string }> => {
    setLoading("metas_pauta_reuniao");
    try {
      return await callProjetoIA("metas_pauta_reuniao", { projetoId });
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar pauta");
      throw err;
    } finally {
      setLoading(null);
    }
  };

  return {
    loading,
    createTasksWithAI,
    createFromFile,
    suggestFields,
    generateChecklist,
    getProjectSummary,
    classifyDocument,
    generateSubtasks,
    refineDescription,
    metasDiagnostico,
    metasPlanoAcao,
    metasPautaReuniao,
  };
}
