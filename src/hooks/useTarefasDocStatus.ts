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
import { proximaAcao, ultimaAtualizacao } from "@/lib/china/docSort";

export interface TarefaDocStatus {
  decisao: DocDecisao;
  total: number;
  aprovados: number;
  /** Última atualização conhecida entre os documentos (ISO) */
  ultimaAtualizacao: string | null;
  /** Próxima ação mais próxima entre os documentos (ISO/date) */
  proximaAcao: string | null;
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
        .select("id, status, created_at, oficializado_em, assinado_em, previsao_envio")
        .in("id", docIds);

      const docPorId = Object.fromEntries(((docs || []) as any[]).map((d) => [d.id, d]));

      const agrupado: Record<string, any[]> = {};
      for (const v of list) {
        (agrupado[v.tarefa_id] ||= []).push(docPorId[v.documento_id] ?? null);
      }

      const map: TarefasDocStatusMap = {};
      for (const [tarefaId, itens] of Object.entries(agrupado)) {
        const statuses = itens.map((d) => (d?.status as string | null) ?? null);
        const decisao = consolidarDecisoes(statuses);
        if (!decisao) continue;
        const atualizacoes = itens
          .filter(Boolean)
          .map((d) => ultimaAtualizacao(d))
          .filter((v): v is number => v !== null);
        const acoes = itens
          .filter(Boolean)
          .map((d) => proximaAcao(d))
          .filter((v): v is number => v !== null);
        map[tarefaId] = {
          decisao,
          total: statuses.length,
          aprovados: statuses.filter((s) => (s || "").toLowerCase() === "aprovado").length,
          ultimaAtualizacao:
            atualizacoes.length > 0 ? new Date(Math.max(...atualizacoes)).toISOString() : null,
          proximaAcao: acoes.length > 0 ? new Date(Math.min(...acoes)).toISOString() : null,
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
