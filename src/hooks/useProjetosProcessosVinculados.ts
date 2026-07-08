import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProcessoVinculado {
  processo_id: string;
  nome: string;
  cor: string | null;
}

/**
 * Retorna, por projeto, a lista de processos operacionais vinculados
 * (via espelhos de tarefa ou refs de etapa de perfil).
 */
export function useProjetosProcessosVinculados(projetoIds: string[]) {
  return useQuery({
    queryKey: ["projetos-processos-vinculados", [...projetoIds].sort()],
    enabled: projetoIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const map = new Map<string, ProcessoVinculado[]>();
      if (projetoIds.length === 0) return map;

      // Fonte 1: espelhos de tarefa (execução real do processo em projeto)
      const { data: espelhos } = await supabase
        .from("processo_tarefa_espelho" as any)
        .select("projeto_id, etapa_id")
        .in("projeto_id", projetoIds);

      const etapaIds = Array.from(
        new Set(((espelhos as any[]) || []).map((e) => e.etapa_id).filter(Boolean)),
      );

      let etapaToProcesso = new Map<string, string>();
      if (etapaIds.length > 0) {
        const { data: etapas } = await supabase
          .from("processo_etapas" as any)
          .select("id, processo_id")
          .in("id", etapaIds);
        for (const e of ((etapas as any[]) || [])) {
          etapaToProcesso.set(e.id, e.processo_id);
        }
      }

      const processoIds = new Set<string>();
      const pares: Array<{ projeto_id: string; processo_id: string }> = [];
      for (const e of ((espelhos as any[]) || [])) {
        const pid = etapaToProcesso.get(e.etapa_id);
        if (pid) {
          processoIds.add(pid);
          pares.push({ projeto_id: e.projeto_id, processo_id: pid });
        }
      }

      let processosById = new Map<string, { nome: string; cor: string | null }>();
      if (processoIds.size > 0) {
        const { data: procs } = await supabase
          .from("processos_operacionais" as any)
          .select("id, nome, cor")
          .in("id", Array.from(processoIds));
        for (const p of ((procs as any[]) || [])) {
          processosById.set(p.id, { nome: p.nome, cor: p.cor });
        }
      }

      const dedupe = new Set<string>();
      for (const { projeto_id, processo_id } of pares) {
        const key = `${projeto_id}::${processo_id}`;
        if (dedupe.has(key)) continue;
        dedupe.add(key);
        const info = processosById.get(processo_id);
        if (!info) continue;
        const arr = map.get(projeto_id) ?? [];
        arr.push({ processo_id, nome: info.nome, cor: info.cor });
        map.set(projeto_id, arr);
      }

      return map;
    },
  });
}
