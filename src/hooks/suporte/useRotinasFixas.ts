import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type RotinaFixa = {
  id: string;
  titulo: string;
  descricao: string | null;
  fila_id: string;
  responsavel_user_id: string;
  lider_user_id: string | null;
  prioridade: "baixa" | "media" | "alta" | "critica";
  sla_primeira_resposta_min: number | null;
  sla_resolucao_min: number | null;
  horario_geracao: string;
  dias_semana: number[];
  checklist: Array<{ texto: string }>;
  categoria: string | null;
  tags: string[];
  gera_tarefa_projeto: boolean;
  projeto_id_espelho: string | null;
  ativo: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type RotinaExecucao = {
  id: string;
  rotina_id: string;
  data_referencia: string;
  ticket_id: string | null;
  tarefa_id: string | null;
  protocolo: string | null;
  status: "gerada" | "em_andamento" | "concluida" | "violada" | "escalada";
  sla_deadline: string | null;
  concluida_em: string | null;
  escalada_em: string | null;
  escalada_para: string | null;
};

export function useRotinasFixas(filaId?: string) {
  return useQuery({
    queryKey: ["rotinas-fixas", filaId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("suporte_rotinas_fixas" as any).select("*").order("created_at", { ascending: false });
      if (filaId) q = q.eq("fila_id", filaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RotinaFixa[];
    },
  });
}

export function useMinhasRotinasHoje() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["minhas-rotinas-hoje", user?.id],
    enabled: !!user?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const { data: rotinas, error: rErr } = await supabase
        .from("suporte_rotinas_fixas" as any)
        .select("id, titulo, prioridade, checklist, fila_id")
        .eq("responsavel_user_id", user!.id)
        .eq("ativo", true);
      if (rErr) throw rErr;
      const ids = ((rotinas ?? []) as any[]).map((r) => r.id);
      if (ids.length === 0) return [] as Array<RotinaExecucao & { titulo: string; prioridade: string; checklist: any[] }>;

      const { data: execs, error: eErr } = await supabase
        .from("suporte_rotina_execucoes" as any)
        .select("*")
        .in("rotina_id", ids)
        .eq("data_referencia", hoje);
      if (eErr) throw eErr;

      return ((execs ?? []) as any[]).map((e) => {
        const rot = (rotinas as any[]).find((r) => r.id === e.rotina_id) ?? {};
        return { ...e, titulo: rot.titulo, prioridade: rot.prioridade, checklist: rot.checklist ?? [] };
      });
    },
  });
}

export function useRotinasEmAtraso() {
  return useQuery({
    queryKey: ["rotinas-em-atraso"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suporte_rotina_execucoes" as any)
        .select("*, rotina:suporte_rotinas_fixas(titulo, responsavel_user_id, fila_id)")
        .in("status", ["violada", "escalada"])
        .order("sla_deadline", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useCreateRotinaFixa() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: Partial<RotinaFixa>) => {
      const { data, error } = await supabase
        .from("suporte_rotinas_fixas" as any)
        .insert({ ...payload, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rotinas-fixas"] });
      toast.success("Rotina fixa criada");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar rotina"),
  });
}

export function useUpdateRotinaFixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<RotinaFixa> & { id: string }) => {
      const { error } = await supabase.from("suporte_rotinas_fixas" as any).update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rotinas-fixas"] });
      toast.success("Rotina atualizada");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });
}

export function useDeleteRotinaFixa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suporte_rotinas_fixas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rotinas-fixas"] });
      toast.success("Rotina removida");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });
}

export function useConcluirRotinaExecucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (execucaoId: string) => {
      const { data, error } = await supabase.rpc("rpc_concluir_rotina_execucao" as any, {
        p_execucao_id: execucaoId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["minhas-rotinas-hoje"] });
      qc.invalidateQueries({ queryKey: ["rotinas-em-atraso"] });
      toast.success("Rotina concluída");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao concluir"),
  });
}

export function useGerarRotinasManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("rpc_gerar_rotinas_fixas_do_dia" as any, {});
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["minhas-rotinas-hoje"] });
      qc.invalidateQueries({ queryKey: ["rotinas-fixas"] });
      if (data?.feriado) toast.info("Hoje é feriado — nenhuma rotina gerada.");
      else toast.success(`${data?.criadas ?? 0} rotina(s) geradas para hoje`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao gerar rotinas"),
  });
}
