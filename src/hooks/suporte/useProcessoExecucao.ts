import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EtapaExecucaoDia {
  etapa_id: string;
  rotina_fixa_id: string;
  rotina_titulo: string;
  fila_id: string;
  fila_nome: string;
  fila_cor: string | null;
  responsavel_user_id: string | null;
  ordem: number;
  sla_minutos: number | null;
  execucao_id: string | null;
  ticket_id: string | null;
  status: string;
  sla_deadline: string | null;
  concluida_em: string | null;
  sla_estourado: boolean;
  minutos_para_deadline: number | null;
  handoff_pendente_de_etapa_id: string | null;
  handoff_sla_minutos: number | null;
}

export interface ProcessoSaudeDia {
  processo_id: string;
  processo_nome: string;
  fila_dona_id: string;
  total_etapas: number;
  concluidas: number;
  em_andamento: number;
  atrasadas: number;
  nao_geradas: number;
}

/** Estado das etapas de um processo em uma data. */
export function useProcessoExecucaoDia(processoId: string | null | undefined, dataRef?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    enabled: !!processoId,
    queryKey: ["processo", "execucao-dia", processoId, dataRef ?? "hoje"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_processo_execucao_dia" as any, {
        _processo_id: processoId!,
        ...(dataRef ? { _data_ref: dataRef } : {}),
      });
      if (error) throw error;
      return (data ?? []) as unknown as EtapaExecucaoDia[];
    },
  });

  // Realtime: reflete mudanças no Kanban de projetos imediatamente
  useEffect(() => {
    if (!processoId) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["processo", "execucao-dia", processoId] });
      qc.invalidateQueries({ queryKey: ["processos", "saude-dia"] });
    };
    const channel = supabase
      .channel(`processo-execucao-${processoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "processo_execucao_etapas" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "processo_tarefa_espelho" },
        invalidate,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [processoId, qc]);

  return query;
}

/** Painel agregado: saúde de todos os processos ativos em uma data. */
export function useProcessosSaudeDia(dataRef?: string) {
  return useQuery({
    queryKey: ["processos", "saude-dia", dataRef ?? "hoje"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_processos_saude_dia" as any, {
        ...(dataRef ? { _data_ref: dataRef } : {}),
      });
      if (error) throw error;
      return (data ?? []) as unknown as ProcessoSaudeDia[];
    },
  });
}
