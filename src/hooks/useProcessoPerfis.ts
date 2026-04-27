import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ProcessoAmbiente = "china" | "brasil" | "fabrica" | "projeto" | "tarefa" | "universal";

export interface ProcessoPerfil {
  id: string;
  nome: string;
  descricao: string | null;
  ambiente: ProcessoAmbiente;
  ativo: boolean;
  padrao: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProcessoPerfilEtapa {
  id: string;
  perfil_id: string;
  codigo: string;
  label: string;
  descricao: string | null;
  ordem: number;
  requer_aprovacao: boolean;
  departamento_responsavel_id: string | null;
  cor: string | null;
  prazo_padrao_dias: number | null;
}

export interface ProcessoEtapaModulo {
  id: string;
  etapa_id: string;
  modulo_codigo: string;
  label: string | null;
  rota: string | null;
  ordem: number;
  auto_criar_registro?: boolean;
  bloqueia_avanco?: boolean;
  config?: Record<string, any>;
}

export interface ProcessoEtapaDocumento {
  id: string;
  etapa_id: string;
  tipo: string;
  label: string;
  descricao: string | null;
  obrigatorio: boolean;
  ordem: number;
}

export interface ProcessoEtapaTarefaTemplateSubtarefa {
  titulo: string;
  prazo_dias?: number;
  prioridade?: "baixa" | "media" | "alta" | "urgente";
}

export interface ProcessoEtapaTarefaTemplate {
  id: string;
  etapa_id: string;
  titulo: string;
  descricao: string | null;
  prazo_dias: number | null;
  responsavel_role: string | null;
  departamento_id: string | null;
  prioridade: "baixa" | "media" | "alta" | "urgente";
  ordem: number;
  modulo_codigo?: string | null;
  subtarefas?: ProcessoEtapaTarefaTemplateSubtarefa[];
  auto_gerar?: boolean;
}

const KEY_PERFIS = ["processo-perfis"];
const keyEtapas = (perfilId: string) => ["processo-perfil-etapas", perfilId];
const keyVinculos = (etapaId: string) => ["processo-etapa-vinculos", etapaId];

export function useProcessoPerfis(ambiente?: ProcessoAmbiente) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: [...KEY_PERFIS, ambiente ?? "all"],
    queryFn: async () => {
      let q = (supabase as any).from("processo_perfis").select("*").order("nome");
      if (ambiente) q = q.eq("ambiente", ambiente);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ProcessoPerfil[];
    },
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: async (input: Partial<ProcessoPerfil> & { nome: string; ambiente: ProcessoAmbiente }) => {
      const { data, error } = await (supabase as any)
        .from("processo_perfis")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as ProcessoPerfil;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_PERFIS });
      toast.success("Perfil criado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar perfil"),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ProcessoPerfil> & { id: string }) => {
      const { error } = await (supabase as any).from("processo_perfis").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_PERFIS });
      toast.success("Perfil atualizado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("processo_perfis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_PERFIS });
      toast.success("Perfil removido");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  return { perfis: list.data ?? [], isLoading: list.isLoading, create, update, remove };
}

export function useProcessoPerfilEtapas(perfilId: string | null) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: keyEtapas(perfilId ?? ""),
    enabled: !!perfilId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("processo_perfil_etapas")
        .select("*")
        .eq("perfil_id", perfilId)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as ProcessoPerfilEtapa[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<ProcessoPerfilEtapa> & { perfil_id: string; codigo: string; label: string }) => {
      const { data, error } = await (supabase as any)
        .from("processo_perfil_etapas")
        .upsert(input, { onConflict: "perfil_id,codigo" })
        .select()
        .single();
      if (error) throw error;
      return data as ProcessoPerfilEtapa;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: keyEtapas(vars.perfil_id) });
      toast.success("Etapa salva");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar etapa"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("processo_perfil_etapas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keyEtapas(perfilId ?? "") });
      toast.success("Etapa removida");
    },
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, idx) =>
          (supabase as any).from("processo_perfil_etapas").update({ ordem: idx }).eq("id", id)
        )
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyEtapas(perfilId ?? "") }),
  });

  return { etapas: list.data ?? [], isLoading: list.isLoading, upsert, remove, reorder };
}

export function useProcessoEtapaVinculos(etapaId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: keyVinculos(etapaId ?? ""),
    enabled: !!etapaId,
    queryFn: async () => {
      const [mods, docs, tarefas] = await Promise.all([
        (supabase as any).from("processo_etapa_modulos").select("*").eq("etapa_id", etapaId).order("ordem"),
        (supabase as any).from("processo_etapa_documentos").select("*").eq("etapa_id", etapaId).order("ordem"),
        (supabase as any).from("processo_etapa_tarefas_template").select("*").eq("etapa_id", etapaId).order("ordem"),
      ]);
      if (mods.error) throw mods.error;
      if (docs.error) throw docs.error;
      if (tarefas.error) throw tarefas.error;
      return {
        modulos: (mods.data ?? []) as ProcessoEtapaModulo[],
        documentos: (docs.data ?? []) as ProcessoEtapaDocumento[],
        tarefas: (tarefas.data ?? []) as ProcessoEtapaTarefaTemplate[],
      };
    },
  });

  const addModulo = useMutation({
    mutationFn: async (input: Omit<ProcessoEtapaModulo, "id">) => {
      const { error } = await (supabase as any).from("processo_etapa_modulos").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyVinculos(etapaId ?? "") }),
  });
  const removeModulo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("processo_etapa_modulos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyVinculos(etapaId ?? "") }),
  });

  const addDocumento = useMutation({
    mutationFn: async (input: Omit<ProcessoEtapaDocumento, "id">) => {
      const { error } = await (supabase as any).from("processo_etapa_documentos").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyVinculos(etapaId ?? "") }),
  });
  const removeDocumento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("processo_etapa_documentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyVinculos(etapaId ?? "") }),
  });

  const addTarefa = useMutation({
    mutationFn: async (input: Omit<ProcessoEtapaTarefaTemplate, "id">) => {
      const { error } = await (supabase as any).from("processo_etapa_tarefas_template").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyVinculos(etapaId ?? "") }),
  });
  const removeTarefa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("processo_etapa_tarefas_template").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyVinculos(etapaId ?? "") }),
  });

  return {
    modulos: query.data?.modulos ?? [],
    documentos: query.data?.documentos ?? [],
    tarefas: query.data?.tarefas ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    addModulo, removeModulo,
    addDocumento, removeDocumento,
    addTarefa, removeTarefa,
  };
}

export async function aplicarPerfilEntidade(
  perfilId: string,
  entidadeTipo: "projeto" | "produto" | "china_submissao" | "tarefa" | "fabrica_ficha",
  entidadeId: string
) {
  const { data, error } = await (supabase as any).rpc("aplicar_perfil_processo", {
    p_perfil_id: perfilId,
    p_entidade_tipo: entidadeTipo,
    p_entidade_id: entidadeId,
  });
  if (error) throw error;
  return data as string;
}

export async function podeAvancarEtapa(instanciaId: string, etapaId: string) {
  const { data, error } = await (supabase as any).rpc("pode_avancar_etapa", {
    p_instancia_id: instanciaId,
    p_etapa_id: etapaId,
  });
  if (error) throw error;
  return data as { pode: boolean; pendencias: Array<{ tipo: string; label: string; codigo?: string }> };
}

// ============================================================
// Instância de processo aplicada a uma entidade (Projeto/Produto)
// ============================================================

export type EntidadeTipo = "projeto" | "produto" | "china_submissao" | "tarefa" | "fabrica_ficha";

export interface ProcessoInstancia {
  id: string;
  perfil_id: string;
  entidade_tipo: EntidadeTipo;
  entidade_id: string;
  etapa_atual_id: string | null;
  status: string;
  data_inicio: string | null;
  data_conclusao: string | null;
}

export function useProcessoInstanciaEntidade(entidadeTipo: EntidadeTipo, entidadeId: string | null | undefined) {
  return useQuery({
    queryKey: ["processo-instancia", entidadeTipo, entidadeId],
    enabled: !!entidadeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("processo_instancias")
        .select("*")
        .eq("entidade_tipo", entidadeTipo)
        .eq("entidade_id", entidadeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ProcessoInstancia | null;
    },
  });
}

export function useEtapaStatus(instanciaId: string | null | undefined) {
  return useQuery({
    queryKey: ["processo-instancia-etapa-status", instanciaId],
    enabled: !!instanciaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("processo_instancia_etapa_status")
        .select("*")
        .eq("instancia_id", instanciaId);
      if (error) throw error;
      return (data ?? []) as Array<{ etapa_id: string; status: string; data_conclusao: string | null }>;
    },
  });
}

export async function avancarEtapa(instanciaId: string, etapaId: string, observacoes?: string) {
  const { data, error } = await (supabase as any).rpc("avancar_etapa_processo", {
    p_instancia_id: instanciaId,
    p_etapa_id: etapaId,
    p_observacoes: observacoes ?? null,
  });
  if (error) throw error;
  return data as
    | { success: true; concluida?: boolean; proxima_etapa_id?: string }
    | { success: false; pendencias: Array<{ tipo: string; label: string; codigo?: string }> };
}
