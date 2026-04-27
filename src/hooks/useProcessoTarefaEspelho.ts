import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TarefaEspelho {
  id: string;
  instancia_id: string;
  etapa_id: string;
  template_id: string | null;
  projeto_tarefa_id: string | null;
  projeto_secao_id: string | null;
  projeto_id: string | null;
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  exige_documentos: boolean;
  observacoes: string | null;
  concluida_em: string | null;
  concluida_por: string | null;
  created_at: string;
  updated_at: string;
  // enriched
  tarefa_titulo?: string;
  tarefa_status?: string;
  projeto_nome?: string;
  secao_nome?: string;
}

/** Lista espelhos de uma instância de processo, enriquecidos com nomes. */
export function useEspelhosDaInstancia(instanciaId: string | null | undefined) {
  return useQuery({
    queryKey: ["processo-tarefa-espelho", instanciaId],
    enabled: !!instanciaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("processo_tarefa_espelho")
        .select("*")
        .eq("instancia_id", instanciaId);
      if (error) throw error;
      const list = (data ?? []) as TarefaEspelho[];
      if (list.length === 0) return list;

      const tarefaIds = [...new Set(list.map((e) => e.projeto_tarefa_id).filter(Boolean))] as string[];
      const projIds = [...new Set(list.map((e) => e.projeto_id).filter(Boolean))] as string[];
      const secIds = [...new Set(list.map((e) => e.projeto_secao_id).filter(Boolean))] as string[];

      const [tRes, pRes, sRes] = await Promise.all([
        tarefaIds.length
          ? (supabase as any).from("projeto_tarefas").select("id, titulo, status").in("id", tarefaIds)
          : { data: [] },
        projIds.length
          ? (supabase as any).from("projetos").select("id, nome").in("id", projIds)
          : { data: [] },
        secIds.length
          ? (supabase as any).from("projeto_secoes").select("id, nome").in("id", secIds)
          : { data: [] },
      ]);

      const tMap = Object.fromEntries(((tRes as any).data ?? []).map((t: any) => [t.id, t]));
      const pMap = Object.fromEntries(((pRes as any).data ?? []).map((p: any) => [p.id, p.nome]));
      const sMap = Object.fromEntries(((sRes as any).data ?? []).map((s: any) => [s.id, s.nome]));

      return list.map((e) => ({
        ...e,
        tarefa_titulo: e.projeto_tarefa_id ? tMap[e.projeto_tarefa_id]?.titulo : undefined,
        tarefa_status: e.projeto_tarefa_id ? tMap[e.projeto_tarefa_id]?.status : undefined,
        projeto_nome: e.projeto_id ? pMap[e.projeto_id] : undefined,
        secao_nome: e.projeto_secao_id ? sMap[e.projeto_secao_id] : undefined,
      }));
    },
  });
}

/** Lista espelhos que envolvem uma tarefa específica do projeto. */
export function useEspelhosDaTarefa(projetoTarefaId: string | null | undefined) {
  return useQuery({
    queryKey: ["processo-tarefa-espelho-by-tarefa", projetoTarefaId],
    enabled: !!projetoTarefaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("processo_tarefa_espelho")
        .select("*, etapa:processo_perfil_etapas(id,label,perfil_id,perfil:processo_perfis(nome))")
        .eq("projeto_tarefa_id", projetoTarefaId);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export interface EvidenciaEtapa {
  espelho_id: string;
  instancia_id: string;
  status: TarefaEspelho["status"];
  exige_documentos: boolean;
  projeto_id: string | null;
  projeto_nome: string | null;
  projeto_tarefa_id: string | null;
  tarefa_titulo: string | null;
  tarefa_status: string | null;
  evidencia_documento_id: string | null;
  evidencia_documento_label: string | null;
  evidencia_observacao: string | null;
  concluida_em: string | null;
  concluida_por: string | null;
  concluida_por_nome: string | null;
  entidade_tipo: string | null;
  entidade_id: string | null;
}

export interface AuditEvidencia {
  id: string;
  espelho_id: string;
  acao: "vinculado" | "alterado" | "removido";
  tarefa_titulo: string | null;
  projeto_nome: string | null;
  documento_anterior_label: string | null;
  documento_novo_label: string | null;
  observacao_anterior: string | null;
  observacao_nova: string | null;
  alterado_por_nome: string | null;
  created_at: string;
}

/** Lista o histórico de auditoria de evidências para uma etapa do perfil. */
export function useAuditEvidenciasDaEtapa(etapaId: string | null | undefined) {
  return useQuery({
    queryKey: ["audit-evidencias-etapa", etapaId],
    enabled: !!etapaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_audit_evidencias_etapa", {
        p_etapa_id: etapaId,
      });
      if (error) throw error;
      return (data ?? []) as AuditEvidencia[];
    },
  });
}

/** Linha do tempo (audit log) de uma tarefa-espelho específica. */
export function useAuditEvidenciasDoEspelho(espelhoId: string | null | undefined) {
  return useQuery({
    queryKey: ["audit-evidencias-espelho", espelhoId],
    enabled: !!espelhoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_audit_evidencias_espelho", {
        p_espelho_id: espelhoId,
      });
      if (error) throw error;
      return (data ?? []) as Omit<AuditEvidencia, "espelho_id" | "tarefa_titulo" | "projeto_nome">[];
    },
  });
}

/** Reenvia notificação para responsáveis e marca espelhos pendentes como "Ação solicitada". */
export function useReenviarAlertasEspelhosPendentes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (etapaId: string) => {
      const { data, error } = await (supabase as any).rpc("reenviar_alertas_espelhos_pendentes", {
        p_etapa_id: etapaId,
      });
      if (error) throw error;
      return data as { ok: boolean; marcados: number; notificados: number };
    },
    onSuccess: (data) => {
      toast.success(
        `Ação solicitada em ${data.marcados} tarefa(s). ${data.notificados} responsável(is) notificado(s).`
      );
      qc.invalidateQueries({ queryKey: ["evidencias-etapa-perfil"] });
      qc.invalidateQueries({ queryKey: ["processo-tarefa-espelho"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao reenviar alertas"),
  });
}

/** Lista evidências (vínculos do projeto + documento usado) de uma etapa de perfil. */
export function useEvidenciasDaEtapa(etapaId: string | null | undefined) {
  return useQuery({
    queryKey: ["evidencias-etapa-perfil", etapaId],
    enabled: !!etapaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_evidencias_etapa_perfil", {
        p_etapa_id: etapaId,
      });
      if (error) throw error;
      return (data ?? []) as EvidenciaEtapa[];
    },
  });
}

export function useCriarTarefaEspelho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      instancia_id: string;
      etapa_id: string;
      projeto_tarefa_id: string;
      exige_documentos?: boolean;
    }) => {
      const { data, error } = await (supabase as any).rpc("criar_tarefa_espelho", {
        p_instancia_id: params.instancia_id,
        p_etapa_id: params.etapa_id,
        p_projeto_tarefa_id: params.projeto_tarefa_id,
        p_exige_documentos: params.exige_documentos ?? true,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Tarefa do projeto vinculada à etapa do processo");
      qc.invalidateQueries({ queryKey: ["processo-tarefa-espelho"] });
      qc.invalidateQueries({ queryKey: ["processo-tarefa-espelho-by-tarefa"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao vincular"),
  });
}

export function useRemoverTarefaEspelho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("processo_tarefa_espelho").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo removido");
      qc.invalidateQueries({ queryKey: ["processo-tarefa-espelho"] });
      qc.invalidateQueries({ queryKey: ["processo-tarefa-espelho-by-tarefa"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });
}

export function useAtualizarStatusEspelho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; status: TarefaEspelho["status"] }) => {
      const { error } = await (supabase as any)
        .from("processo_tarefa_espelho")
        .update({ status: params.status })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["processo-tarefa-espelho"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });
}

/** Lista os documentos oficiais (template) de uma etapa de uma instância,
 *  marcando quais já foram registrados como entregues. */
export function useDocsOficiaisEtapa(instanciaId: string | null | undefined, etapaId: string | null | undefined) {
  return useQuery({
    queryKey: ["docs-oficiais-etapa", instanciaId, etapaId],
    enabled: !!instanciaId && !!etapaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("listar_docs_oficiais_etapa", {
        p_instancia_id: instanciaId,
        p_etapa_id: etapaId,
      });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        tipo: string;
        label: string;
        obrigatorio: boolean;
        entregue: boolean;
      }[];
    },
  });
}

/** Conclui um espelho registrando o documento oficial usado como evidência.
 *  - Marca o doc no checklist da etapa
 *  - Conclui o espelho
 *  - Reflete a conclusão na tarefa do projeto */
export function useConcluirEspelhoComEvidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { espelho_id: string; documento_id: string; observacao?: string }) => {
      const { data, error } = await (supabase as any).rpc("concluir_espelho_com_evidencia", {
        p_espelho_id: params.espelho_id,
        p_documento_id: params.documento_id,
        p_observacao: params.observacao ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; espelho_id: string; documento_id: string };
    },
    onSuccess: () => {
      toast.success("Tarefa concluída e evidência registrada no processo");
      qc.invalidateQueries({ queryKey: ["processo-tarefa-espelho"] });
      qc.invalidateQueries({ queryKey: ["processo-tarefa-espelho-by-tarefa"] });
      qc.invalidateQueries({ queryKey: ["docs-oficiais-etapa"] });
      qc.invalidateQueries({ queryKey: ["projeto-tarefas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao concluir"),
  });
}
