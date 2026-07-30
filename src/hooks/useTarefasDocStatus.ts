/**
 * useTarefasDocStatus — consolida o status administrativo dos documentos da
 * submissão China vinculados a cada tarefa, para exibição no quadro (Kanban).
 *
 * Retorna, por tarefa: decisão consolidada, total de documentos e quantos
 * já estão aprovados.
 */
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { consolidarDecisoes, type DocDecisao } from "@/lib/china/docStatus";

export interface TarefaDocStatus {
  decisao: DocDecisao;
  total: number;
  aprovados: number;
}

export type TarefasDocStatusMap = Record<string, TarefaDocStatus>;

export function useTarefasDocStatus(projetoId: string | undefined, tarefaIds: string[]) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["tarefas-doc-status", projetoId, tarefaIds.length],
    enabled: !!projetoId && tarefaIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<TarefasDocStatusMap> => {
      const { data: vinculos, error } = await (supabase
        .from("china_documento_tarefa_vinculos" as any)
        .select("tarefa_id, documento_id")
        .in("tarefa_id", tarefaIds) as any);
      if (error) throw error;

      const list = (vinculos || []) as Array<{ tarefa_id: string; documento_id: string }>;
      if (list.length === 0) return {};

      const docIds = [...new Set(list.map((v) => v.documento_id))];
      const { data: docs } = await supabase
        .from("china_produto_documentos")
        .select("id, status")
        .in("id", docIds);

      const statusPorDoc = Object.fromEntries(
        ((docs || []) as any[]).map((d) => [d.id, d.status as string | null]),
      );

      const agrupado: Record<string, Array<string | null>> = {};
      for (const v of list) {
        (agrupado[v.tarefa_id] ||= []).push(statusPorDoc[v.documento_id] ?? null);
      }

      const map: TarefasDocStatusMap = {};
      for (const [tarefaId, statuses] of Object.entries(agrupado)) {
        const decisao = consolidarDecisoes(statuses);
        if (!decisao) continue;
        map[tarefaId] = {
          decisao,
          total: statuses.length,
          aprovados: statuses.filter((s) => (s || "").toLowerCase() === "aprovado").length,
        };
      }
      return map;
    },
  });

  useEffect(() => {
    if (!projetoId) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["tarefas-doc-status"] });
    };
    const channel = supabase
      .channel(`tarefas-doc-status-${projetoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_produto_documentos" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "china_documento_tarefa_vinculos" },
        invalidate,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projetoId, qc]);

  return query;
}
