import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DocWorkflowConfig {
  id: string;
  tipo_documento: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export interface DocWorkflowEtapa {
  id: string;
  config_id: string;
  nome: string;
  departamento_responsavel_id: string | null;
  ordem: number;
  tipo_acao: string;
  created_at: string;
}

export interface DocWorkflowInstancia {
  id: string;
  juntada_id: string;
  config_id: string;
  etapa_atual: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DocWorkflowTransicao {
  id: string;
  instancia_id: string;
  etapa_nome: string;
  acao: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  observacao: string | null;
  created_at: string;
}

// Hook for workflow configs (admin)
export function useDocWorkflowConfigs() {
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["doc-workflow-configs"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_doc_workflow_config" as any)
        .select("*")
        .order("tipo_documento") as any);
      if (error) throw error;
      return (data || []) as DocWorkflowConfig[];
    },
  });

  const addConfig = useMutation({
    mutationFn: async (input: { tipo_documento: string; nome: string }) => {
      const { data, error } = await (supabase
        .from("process_doc_workflow_config" as any)
        .insert(input)
        .select()
        .single() as any);
      if (error) throw error;
      return data as DocWorkflowConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-workflow-configs"] });
      toast.success("Workflow criado");
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("process_doc_workflow_config" as any)
        .delete()
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-workflow-configs"] });
      toast.success("Workflow removido");
    },
  });

  return { configs, isLoading, addConfig, deleteConfig };
}

// Hook for etapas of a config
export function useDocWorkflowEtapas(configId: string | null) {
  const queryClient = useQueryClient();

  const { data: etapas = [], isLoading } = useQuery({
    queryKey: ["doc-workflow-etapas", configId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_doc_workflow_etapas" as any)
        .select("*")
        .eq("config_id", configId!)
        .order("ordem") as any);
      if (error) throw error;
      return (data || []) as DocWorkflowEtapa[];
    },
    enabled: !!configId,
  });

  const addEtapa = useMutation({
    mutationFn: async (input: {
      config_id: string;
      nome: string;
      departamento_responsavel_id?: string;
      ordem: number;
      tipo_acao: string;
    }) => {
      const { error } = await (supabase
        .from("process_doc_workflow_etapas" as any)
        .insert(input) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-workflow-etapas", configId] });
    },
  });

  const deleteEtapa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase
        .from("process_doc_workflow_etapas" as any)
        .delete()
        .eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-workflow-etapas", configId] });
    },
  });

  return { etapas, isLoading, addEtapa, deleteEtapa };
}

// Hook for workflow instance of a juntada
export function useDocWorkflowInstance(juntadaId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: instancia, isLoading: instanciaLoading } = useQuery({
    queryKey: ["doc-workflow-instancia", juntadaId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_doc_workflow_instancias" as any)
        .select("*")
        .eq("juntada_id", juntadaId!)
        .maybeSingle() as any);
      if (error) throw error;
      return data as DocWorkflowInstancia | null;
    },
    enabled: !!juntadaId,
  });

  const { data: transicoes = [] } = useQuery({
    queryKey: ["doc-workflow-transicoes", instancia?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_doc_workflow_transicoes" as any)
        .select("*")
        .eq("instancia_id", instancia!.id)
        .order("created_at", { ascending: true }) as any);
      if (error) throw error;
      return (data || []) as DocWorkflowTransicao[];
    },
    enabled: !!instancia?.id,
  });

  const iniciarWorkflow = useMutation({
    mutationFn: async (input: { juntada_id: string; config_id: string }) => {
      const { error } = await (supabase
        .from("process_doc_workflow_instancias" as any)
        .insert({ ...input, etapa_atual: 0, status: "em_andamento" }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-workflow-instancia", juntadaId] });
      toast.success("Subprocesso documental iniciado");
    },
  });

  const registrarTransicao = useMutation({
    mutationFn: async (input: {
      instancia_id: string;
      etapa_nome: string;
      acao: string;
      observacao?: string;
      nova_etapa?: number;
      novo_status?: string;
    }) => {
      // Insert transition
      const { error: tError } = await (supabase
        .from("process_doc_workflow_transicoes" as any)
        .insert({
          instancia_id: input.instancia_id,
          etapa_nome: input.etapa_nome,
          acao: input.acao,
          usuario_id: user?.id,
          usuario_nome: user?.email,
          observacao: input.observacao,
        }) as any);
      if (tError) throw tError;

      // Update instance
      if (input.nova_etapa !== undefined || input.novo_status) {
        const update: any = { updated_at: new Date().toISOString() };
        if (input.nova_etapa !== undefined) update.etapa_atual = input.nova_etapa;
        if (input.novo_status) update.status = input.novo_status;
        const { error: uError } = await (supabase
          .from("process_doc_workflow_instancias" as any)
          .update(update)
          .eq("id", input.instancia_id) as any);
        if (uError) throw uError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doc-workflow-instancia", juntadaId] });
      queryClient.invalidateQueries({ queryKey: ["doc-workflow-transicoes"] });
      toast.success("Ação registrada no subprocesso");
    },
  });

  return { instancia, instanciaLoading, transicoes, iniciarWorkflow, registrarTransicao };
}
