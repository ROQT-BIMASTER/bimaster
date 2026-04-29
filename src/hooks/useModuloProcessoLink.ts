import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ModuloLinkStatus = "pendente" | "em_andamento" | "concluido" | "cancelado";

export interface ModuloProcessoLink {
  id: string;
  modulo_codigo: string;
  registro_id: string;
  instancia_id: string;
  etapa_id: string;
  status: ModuloLinkStatus;
  observacoes: string | null;
  concluido_em: string | null;
  concluido_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModuloLinkEnriquecido extends ModuloProcessoLink {
  etapa_label?: string;
  etapa_codigo?: string;
  perfil_id?: string;
  perfil_nome?: string;
  entidade_tipo?: string;
  entidade_id?: string;
}

/**
 * Lista todos os vínculos para um registro específico de um módulo
 * (ex: todos os processos que dependem desta etiqueta).
 */
export function useLinksDoRegistro(moduloCodigo: string, registroId: string | null | undefined) {
  return useQuery({
    queryKey: ["modulo-link-registro", moduloCodigo, registroId],
    enabled: !!registroId && !!moduloCodigo,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("modulo_processo_link")
        .select("*")
        .eq("modulo_codigo", moduloCodigo)
        .eq("registro_id", registroId);
      if (error) throw error;
      const links = (data ?? []) as ModuloProcessoLink[];
      if (links.length === 0) return [] as ModuloLinkEnriquecido[];

      const etapaIds = [...new Set(links.map((l) => l.etapa_id))];
      const instanciaIds = [...new Set(links.map((l) => l.instancia_id))];

      const [etapasRes, instanciasRes] = await Promise.all([
        (supabase as any).from("processo_perfil_etapas").select("id, codigo, label, perfil_id").in("id", etapaIds),
        (supabase as any).from("processo_instancias").select("id, perfil_id, entidade_tipo, entidade_id").in("id", instanciaIds),
      ]);

      const perfilIds = [...new Set((instanciasRes.data ?? []).map((i: any) => i.perfil_id))];
      const perfisRes = perfilIds.length
        ? await (supabase as any).from("processo_perfis").select("id, nome").in("id", perfilIds)
        : { data: [] };

      const etapaMap = Object.fromEntries((etapasRes.data ?? []).map((e: any) => [e.id, e]));
      const instMap = Object.fromEntries((instanciasRes.data ?? []).map((i: any) => [i.id, i]));
      const perfilMap = Object.fromEntries((perfisRes.data ?? []).map((p: any) => [p.id, p.nome]));

      return links.map((l) => {
        const e = etapaMap[l.etapa_id];
        const i = instMap[l.instancia_id];
        return {
          ...l,
          etapa_label: e?.label,
          etapa_codigo: e?.codigo,
          perfil_id: i?.perfil_id,
          perfil_nome: i?.perfil_id ? perfilMap[i.perfil_id] : undefined,
          entidade_tipo: i?.entidade_tipo,
          entidade_id: i?.entidade_id,
        } as ModuloLinkEnriquecido;
      });
    },
  });
}

/**
 * Lista vínculos da instância (todos os módulos vinculados ao processo)
 */
export function useLinksDaInstancia(instanciaId: string | null | undefined) {
  return useQuery({
    queryKey: ["modulo-link-instancia", instanciaId],
    enabled: !!instanciaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("modulo_processo_link")
        .select("*")
        .eq("instancia_id", instanciaId);
      if (error) throw error;
      return (data ?? []) as ModuloProcessoLink[];
    },
  });
}

export function useConcluirModuloLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      modulo_codigo: string;
      registro_id: string;
      etapa_id: string;
      observacoes?: string;
    }) => {
      const { data, error } = await supabase.rpc("concluir_modulo_link", {
        p_modulo_codigo: params.modulo_codigo,
        p_registro_id: params.registro_id,
        p_etapa_id: params.etapa_id,
        p_observacoes: params.observacoes ?? null,
      });
      if (error) throw error;
      return data as { success: boolean; updated: number };
    },
    onSuccess: () => {
      toast.success("Etapa do módulo concluída");
      qc.invalidateQueries({ queryKey: ["modulo-link-registro"] });
      qc.invalidateQueries({ queryKey: ["modulo-link-instancia"] });
      qc.invalidateQueries({ queryKey: ["processo-instancia-etapa-status"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao concluir"),
  });
}

export function useVincularModuloAEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      modulo_codigo: string;
      registro_id: string;
      instancia_id: string;
      etapa_id: string;
      status?: ModuloLinkStatus;
    }) => {
      const { data, error } = await supabase.rpc("vincular_modulo_a_etapa", {
        p_modulo_codigo: params.modulo_codigo,
        p_registro_id: params.registro_id,
        p_instancia_id: params.instancia_id,
        p_etapa_id: params.etapa_id,
        p_status: params.status ?? "em_andamento",
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Módulo vinculado à etapa");
      qc.invalidateQueries({ queryKey: ["modulo-link-registro"] });
      qc.invalidateQueries({ queryKey: ["modulo-link-instancia"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao vincular"),
  });
}
