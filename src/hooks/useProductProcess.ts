import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ETAPAS_CICLO_VIDA = [
  { key: "ideia", label: "Ideia", ordem: 1 },
  { key: "projeto", label: "Projeto", ordem: 2 },
  { key: "pre_cadastro", label: "Pré-cadastro", ordem: 3 },
  { key: "desenvolvimento", label: "Desenvolvimento", ordem: 4 },
  { key: "testes", label: "Testes", ordem: 5 },
  { key: "embalagem", label: "Embalagem", ordem: 6 },
  { key: "regulatorio", label: "Regulatório", ordem: 7 },
  { key: "cadastro_final", label: "Cadastro Final", ordem: 8 },
  { key: "aprovacao", label: "Aprovação", ordem: 9 },
  { key: "producao", label: "Produção", ordem: 10 },
  { key: "lancamento", label: "Lançamento", ordem: 11 },
  { key: "recebimento", label: "Recebimento Brasil", ordem: 12 },
] as const;

export type EtapaKey = typeof ETAPAS_CICLO_VIDA[number]["key"];

export interface ProductProcess {
  id: string;
  produto_tipo: "china" | "brasil" | "fabrica";
  produto_ref_id: string;
  numero_processo: string;
  status: string;
  etapa_atual: string;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessEvent {
  id: string;
  process_id: string;
  tipo_evento: string;
  descricao: string | null;
  modulo_origem: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  metadata: Record<string, any>;
  ref_entity_id: string | null;
  ref_entity_table: string | null;
  created_at: string;
}

export interface ProcessStepHistory {
  id: string;
  process_id: string;
  etapa: string;
  status: string;
  responsavel_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  tempo_permanencia_minutos: number | null;
  observacao: string | null;
  created_at: string;
}

/**
 * Hook principal do Processo Unificado do Produto
 */
export function useProductProcess(produtoTipo: string, produtoRefId: string | undefined) {
  const queryClient = useQueryClient();

  // Buscar processo existente (sem side-effects)
  const { data: process, isLoading: processLoading } = useQuery({
    queryKey: ["product-process", produtoTipo, produtoRefId],
    queryFn: async () => {
      if (!produtoRefId) return null;

      const { data, error } = await (supabase
        .from("product_process" as any)
        .select("*")
        .eq("produto_tipo", produtoTipo)
        .eq("produto_ref_id", produtoRefId)
        .maybeSingle() as any);

      if (error) throw error;
      return (data as ProductProcess) || null;
    },
    enabled: !!produtoRefId,
  });

  // Mutation explícita para criar processo quando necessário
  const createProcess = useMutation({
    mutationFn: async () => {
      if (!produtoRefId) throw new Error("produtoRefId obrigatório");
      const { data: { user } } = await supabase.auth.getUser();
      const { data: created, error: createErr } = await (supabase
        .from("product_process" as any)
        .insert({
          produto_tipo: produtoTipo,
          produto_ref_id: produtoRefId,
          criado_por: user?.id,
          etapa_atual: "ideia",
        })
        .select()
        .single() as any);

      if (createErr) {
        // Might have been created by trigger, try again
        const { data: retry } = await (supabase
          .from("product_process" as any)
          .select("*")
          .eq("produto_tipo", produtoTipo)
          .eq("produto_ref_id", produtoRefId)
          .maybeSingle() as any);
        if (retry) return retry as ProductProcess;
        throw createErr;
      }
      return created as ProductProcess;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-process", produtoTipo, produtoRefId] });
    },
  });

  // Eventos do processo (timeline nativa)
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["process-events", process?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_events" as any)
        .select("*")
        .eq("process_id", process!.id)
        .order("created_at", { ascending: false })
        .limit(100) as any);
      if (error) throw error;
      return (data || []) as ProcessEvent[];
    },
    enabled: !!process?.id,
  });

  // Histórico de etapas
  const { data: stepHistory = [], isLoading: stepsLoading } = useQuery({
    queryKey: ["process-step-history", process?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_step_history" as any)
        .select("*")
        .eq("process_id", process!.id)
        .order("created_at", { ascending: true }) as any);
      if (error) throw error;
      return (data || []) as ProcessStepHistory[];
    },
    enabled: !!process?.id,
  });

  // Timeline unificada (view que agrega todos os históricos)
  const { data: unifiedTimeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ["unified-timeline", produtoRefId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("vw_process_timeline" as any)
        .select("*")
        .eq("entity_id", produtoRefId!)
        .order("created_at", { ascending: false })
        .limit(200) as any);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!produtoRefId,
  });

  // Adicionar evento manual
  const addEvent = useMutation({
    mutationFn: async (event: {
      tipo_evento: string;
      descricao: string;
      modulo_origem?: string;
      metadata?: Record<string, any>;
    }) => {
      if (!process?.id) throw new Error("Processo não encontrado");
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user!.id)
        .maybeSingle();

      const { error } = await (supabase
        .from("process_events" as any)
        .insert({
          process_id: process.id,
          tipo_evento: event.tipo_evento,
          descricao: event.descricao,
          modulo_origem: event.modulo_origem || "manual",
          usuario_id: user?.id,
          usuario_nome: profile?.nome || user?.email || "Usuário",
          metadata: event.metadata || {},
        }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["process-events", process?.id] });
    },
  });

  // Avançar etapa
  const advanceStep = useMutation({
    mutationFn: async (params: { novaEtapa: EtapaKey; observacao?: string }) => {
      if (!process?.id) throw new Error("Processo não encontrado");
      const { data: { user } } = await supabase.auth.getUser();

      // Close current step
      await (supabase
        .from("process_step_history" as any)
        .update({ status: "concluido", data_fim: new Date().toISOString() })
        .eq("process_id", process.id)
        .eq("etapa", process.etapa_atual)
        .eq("status", "em_andamento") as any);

      // Open new step
      await (supabase
        .from("process_step_history" as any)
        .insert({
          process_id: process.id,
          etapa: params.novaEtapa,
          status: "em_andamento",
          responsavel_id: user?.id,
          data_inicio: new Date().toISOString(),
          observacao: params.observacao,
        }) as any);

      // Update process
      await (supabase
        .from("product_process" as any)
        .update({ etapa_atual: params.novaEtapa })
        .eq("id", process.id) as any);

      // Log event
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user!.id)
        .maybeSingle();

      await (supabase
        .from("process_events" as any)
        .insert({
          process_id: process.id,
          tipo_evento: "etapa_change",
          descricao: `Etapa avançada: ${process.etapa_atual} → ${params.novaEtapa}`,
          modulo_origem: "processo",
          usuario_id: user?.id,
          usuario_nome: profile?.nome || user?.email,
          metadata: { etapa_anterior: process.etapa_atual, nova_etapa: params.novaEtapa },
        }) as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-process"] });
      queryClient.invalidateQueries({ queryKey: ["process-events"] });
      queryClient.invalidateQueries({ queryKey: ["process-step-history"] });
    },
  });

  // Combinar timeline nativa + unificada (sem duplicatas)
  const combinedTimeline = [...events, ...unifiedTimeline]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter((item, index, arr) => arr.findIndex(x => x.id === item.id) === index);

  // Calcular SLA por etapa
  const slaByStep = ETAPAS_CICLO_VIDA.map(etapa => {
    const history = stepHistory.filter(s => s.etapa === etapa.key);
    const totalMinutes = history.reduce((sum, s) => sum + (s.tempo_permanencia_minutos || 0), 0);
    const currentStep = history.find(s => s.status === "em_andamento");
    return {
      ...etapa,
      totalMinutes,
      isActive: currentStep !== null,
      history,
    };
  });

  return {
    process,
    processLoading,
    createProcess,
    events,
    eventsLoading,
    stepHistory,
    stepsLoading,
    unifiedTimeline,
    timelineLoading,
    combinedTimeline,
    slaByStep,
    addEvent,
    advanceStep,
    isLoading: processLoading || eventsLoading,
  };
}
