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
