import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  return {
    loading,
    createTasksWithAI,
    createFromFile,
    suggestFields,
    generateChecklist,
    getProjectSummary,
    classifyDocument,
  };
}
