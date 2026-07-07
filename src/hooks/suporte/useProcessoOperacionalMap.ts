import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProcessoOperacionalTag {
  projeto_tarefa_id: string;
  processo_nome: string;
  etapa_ordem: number;
  total_etapas: number;
  sla_limite: string | null;
}

/**
 * Retorna um Map indexado por `projeto_tarefa_id` com metadados de processo
 * operacional (nome do processo, "Etapa X/Y", SLA limite). Usado para
 * renderizar `ProcessoOperacionalBadge` em cards de Minhas Tarefas e Central.
 */
export function useProcessoOperacionalMap(tarefaIds: string[]) {
  const key = tarefaIds.slice().sort().join(",");
  return useQuery({
    queryKey: ["processo-operacional-map", key],
    enabled: tarefaIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const map = new Map<string, ProcessoOperacionalTag>();
      if (tarefaIds.length === 0) return map;

      const { data: esp } = await (supabase as any)
        .from("processo_tarefa_espelho")
        .select("projeto_tarefa_id, etapa_id, sla_limite")
        .in("projeto_tarefa_id", tarefaIds);

      const espelhos = (esp ?? []) as Array<{
        projeto_tarefa_id: string;
        etapa_id: string;
        sla_limite: string | null;
      }>;
      if (espelhos.length === 0) return map;

      const etapaIds = Array.from(new Set(espelhos.map((e) => e.etapa_id)));
      const { data: etapas } = await (supabase as any)
        .from("processo_etapas")
        .select("id, ordem, processo_id, nome_override")
        .in("id", etapaIds);
      const etapaById = new Map<string, any>();
      for (const e of etapas ?? []) etapaById.set(e.id, e);

      const processoIds = Array.from(
        new Set((etapas ?? []).map((e: any) => e.processo_id)),
      );
      const { data: procs } = await (supabase as any)
        .from("processos_operacionais")
        .select("id, nome")
        .in("id", processoIds);
      const procById = new Map<string, any>();
      for (const p of procs ?? []) procById.set(p.id, p);

      // total de etapas por processo
      const { data: allEtapas } = await (supabase as any)
        .from("processo_etapas")
        .select("processo_id")
        .in("processo_id", processoIds);
      const totais = new Map<string, number>();
      for (const e of allEtapas ?? []) {
        totais.set(e.processo_id, (totais.get(e.processo_id) ?? 0) + 1);
      }

      for (const row of espelhos) {
        const etapa = etapaById.get(row.etapa_id);
        if (!etapa) continue;
        const proc = procById.get(etapa.processo_id);
        map.set(row.projeto_tarefa_id, {
          projeto_tarefa_id: row.projeto_tarefa_id,
          processo_nome: proc?.nome ?? "Processo operacional",
          etapa_ordem: etapa.ordem ?? 0,
          total_etapas: totais.get(etapa.processo_id) ?? 0,
          sla_limite: row.sla_limite,
        });
      }
      return map;
    },
  });
}
