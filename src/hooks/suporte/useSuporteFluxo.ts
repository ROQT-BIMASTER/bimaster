import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SecaoKanban {
  id: string;
  nome: string;
  ordem: number;
}

export interface EtapaMensagem {
  id: string;
  fila_id: string;
  secao_id: string;
  mensagem: string | null;
  status_map: string | null;
  notificar: boolean;
  ativo: boolean;
}

export function useSuporteFluxo(filaId: string | null, projetoId: string | null) {
  return useQuery({
    queryKey: ["suporte", "fluxo", filaId, projetoId],
    enabled: !!filaId && !!projetoId,
    staleTime: 15_000,
    queryFn: async () => {
      const [secoesRes, msgsRes] = await Promise.all([
        supabase
          .from("projeto_secoes")
          .select("id, nome, ordem")
          .eq("projeto_id", projetoId!)
          .order("ordem", { ascending: true }),
        supabase
          .from("suporte_etapa_mensagens" as any)
          .select("id, fila_id, secao_id, mensagem, status_map, notificar, ativo")
          .eq("fila_id", filaId!),
      ]);
      if (secoesRes.error) throw secoesRes.error;
      if (msgsRes.error) throw msgsRes.error;
      const secoes = (secoesRes.data ?? []) as SecaoKanban[];
      const mensagens = ((msgsRes.data ?? []) as unknown) as EtapaMensagem[];
      return { secoes, mensagens };
    },
  });
}

export function useSuporteFluxoMutations(filaId: string | null) {
  const qc = useQueryClient();

  const upsertMensagem = useMutation({
    mutationFn: async (p: {
      secao_id: string;
      mensagem: string;
      status_map: string | null;
      notificar: boolean;
      ativo: boolean;
    }) => {
      const { error } = await supabase
        .from("suporte_etapa_mensagens" as any)
        .upsert(
          {
            fila_id: filaId,
            secao_id: p.secao_id,
            mensagem: p.mensagem || null,
            status_map: p.status_map,
            notificar: p.notificar,
            ativo: p.ativo,
          } as any,
          { onConflict: "fila_id,secao_id" } as any,
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte", "fluxo", filaId] });
      toast.success("Mensagem da etapa salva.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  const criarProjeto = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc(
        "rpc_suporte_fila_criar_projeto" as any,
        { p_fila_id: filaId },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte", "filas"] });
      qc.invalidateQueries({ queryKey: ["suporte", "minhas-filas"] });
      qc.invalidateQueries({ queryKey: ["suporte", "fluxo", filaId] });
      toast.success("Projeto do departamento criado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar projeto."),
  });

  const vincularProjeto = useMutation({
    mutationFn: async (projetoId: string | null) => {
      const { error } = await supabase.rpc(
        "rpc_suporte_fila_vincular_projeto" as any,
        { p_fila_id: filaId, p_projeto_id: projetoId },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte", "filas"] });
      qc.invalidateQueries({ queryKey: ["suporte", "minhas-filas"] });
      qc.invalidateQueries({ queryKey: ["suporte", "fluxo", filaId] });
      toast.success("Vínculo atualizado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao vincular."),
  });

  const alternarAutoCriar = useMutation({
    mutationFn: async (v: boolean) => {
      const { error } = await supabase
        .from("suporte_filas" as any)
        .update({ auto_criar_tarefa: v } as any)
        .eq("id", filaId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte", "filas"] });
      qc.invalidateQueries({ queryKey: ["suporte", "minhas-filas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar."),
  });

  return { upsertMensagem, criarProjeto, vincularProjeto, alternarAutoCriar };
}

/** Projetos visíveis para vincular manualmente. */
export function useProjetosVisiveis() {
  return useQuery({
    queryKey: ["suporte", "projetos-visiveis"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, nome")
        .eq("status", "ativo")
        .order("nome")
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome: string }>;
    },
  });
}

/** Etapa (nome da seção + projeto_id) para o badge no drawer. */
export function useTicketEtapa(projetoTarefaId: string | null | undefined) {
  return useQuery({
    queryKey: ["suporte", "ticket-etapa", projetoTarefaId],
    enabled: !!projetoTarefaId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: tarefa, error } = await supabase
        .from("projeto_tarefas")
        .select("id, projeto_id, secao_id")
        .eq("id", projetoTarefaId!)
        .maybeSingle();
      if (error) throw error;
      if (!tarefa?.secao_id) return null;
      const { data: secao } = await supabase
        .from("projeto_secoes")
        .select("nome")
        .eq("id", tarefa.secao_id)
        .maybeSingle();
      return {
        projeto_id: tarefa.projeto_id as string,
        secao_id: tarefa.secao_id as string,
        etapa: (secao?.nome as string) ?? "",
      };
    },
  });
}
