import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface LoteAprovacao {
  id: string;
  config_id: string;
  tarefa_id: string | null;
  secao_id: string | null;
  projeto_id: string | null;
  lote_nome: string | null;
  titulo: string | null;
  descricao: string | null;
  status: string;
  etapa_atual_ordem: number;
  rodada: number;
  prazo_lote: string | null;
  politica_movimentacao: string;
  created_at: string;
  created_by: string | null;
}

export interface LoteEtapa {
  id: string;
  config_id: string;
  ordem: number;
  nome: string;
  prazo_dias: number | null;
  responsavel_id: string | null;
  responsavel_secundario_id: string | null;
  tipo_aprovacao: string;
}

export interface LoteEvento {
  id: string;
  instancia_id: string;
  etapa_ordem: number;
  etapa_nome: string | null;
  rodada: number;
  decisao: string;
  responsavel_id: string | null;
  decidido_por: string | null;
  comentario: string | null;
  entrou_em: string;
  prazo_em: string | null;
  concluido_em: string | null;
}

export interface LoteDocumento {
  id: string;
  instancia_id: string;
  documento_id: string;
  ordem: number;
  nome_arquivo: string | null;
  tipo_documento: string | null;
  arquivo_path: string | null;
  arquivo_url: string | null;
}

export function useLotesDaTarefa(tarefaId: string | undefined) {
  return useQuery({
    queryKey: ["lotes-aprovacao", "tarefa", tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_aprovacao_instancias")
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LoteAprovacao[];
    },
  });
}

export function useLoteEtapas(configId: string | undefined) {
  return useQuery({
    queryKey: ["lote-etapas", configId],
    enabled: !!configId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_aprovacao_etapas")
        .select("*")
        .eq("config_id", configId!)
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data || []) as LoteEtapa[];
    },
  });
}

export function useLoteEventos(instanciaId: string | undefined) {
  return useQuery({
    queryKey: ["lote-eventos", instanciaId],
    enabled: !!instanciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_aprovacao_etapa_eventos")
        .select("*")
        .eq("instancia_id", instanciaId!)
        .order("entrou_em", { ascending: true });
      if (error) throw error;
      return (data || []) as LoteEvento[];
    },
  });
}

export function useLoteDocumentos(instanciaId: string | undefined) {
  return useQuery({
    queryKey: ["lote-documentos", instanciaId],
    enabled: !!instanciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_aprovacao_lote_documentos")
        .select("id, instancia_id, documento_id, ordem, china_produto_documentos(nome_arquivo, tipo_documento, arquivo_path, arquivo_url)")
        .eq("instancia_id", instanciaId!)
        .order("ordem");
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        id: r.id,
        instancia_id: r.instancia_id,
        documento_id: r.documento_id,
        ordem: r.ordem,
        nome_arquivo: r.china_produto_documentos?.nome_arquivo ?? null,
        tipo_documento: r.china_produto_documentos?.tipo_documento ?? null,
        arquivo_path: r.china_produto_documentos?.arquivo_path ?? null,
        arquivo_url: r.china_produto_documentos?.arquivo_url ?? null,
      })) as LoteDocumento[];
    },
  });
}

export function useTemplatesAlcadas() {
  return useQuery({
    queryKey: ["templates-alcadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_aprovacao_config")
        .select("id, nome, descricao, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as Array<{ id: string; nome: string; descricao: string | null; ativo: boolean }>;
    },
  });
}

export function useCriarLoteAprovacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      tarefaId: string;
      configId: string;
      loteNome: string;
      documentoIds: string[];
      prazoLote?: string | null;
      politica?: "continuar" | "reiniciar_etapa";
    }) => {
      const { data, error } = await supabase.rpc("rpc_criar_lote_aprovacao", {
        p_tarefa_id: input.tarefaId,
        p_config_id: input.configId,
        p_lote_nome: input.loteNome,
        p_documento_ids: input.documentoIds,
        p_prazo_lote: input.prazoLote ?? undefined,
        p_politica: input.politica ?? undefined,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      toast.success("Lote de aprovação criado");
      qc.invalidateQueries({ queryKey: ["lotes-aprovacao", "tarefa", vars.tarefaId] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao criar lote"),
  });
}

export function useAvancarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { instanciaId: string; decisao: "aprovado" | "rejeitado"; comentario?: string }) => {
      const { data, error } = await supabase.rpc("rpc_avancar_etapa_aprovacao", {
        p_instancia_id: input.instanciaId,
        p_decisao: input.decisao,
        p_comentario: input.comentario,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.decisao === "aprovado" ? "Etapa aprovada" : "Etapa rejeitada — nova rodada aberta");
      qc.invalidateQueries({ queryKey: ["lotes-aprovacao"] });
      qc.invalidateQueries({ queryKey: ["lote-eventos", vars.instanciaId] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao avançar etapa"),
  });
}
