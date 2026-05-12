import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChinaTimelineEvent, ChinaTimelineScope } from "@/lib/china/timeline/types";

const KIND_ACTOR: Record<string, "china" | "brasil" | "sistema"> = {
  submissao_criada: "china",
  documento_anexado: "china",
  parecer_china: "china",
  apontamento_producao: "china",
  embarque_criado: "china",
  oc_emitida: "brasil",
  liberada_para_oc: "brasil",
  recebimento_iniciado: "brasil",
};

function inferActor(kind: string): "china" | "brasil" | "sistema" {
  return KIND_ACTOR[kind] || "sistema";
}

function buildQuery(scope: ChinaTimelineScope) {
  let q = supabase
    .from("china_timeline_eventos" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const filters: string[] = [];
  if (scope.submissaoId) filters.push(`submissao_id.eq.${scope.submissaoId}`);
  if (scope.ocId) filters.push(`ordem_compra_id.eq.${scope.ocId}`);
  if (scope.opId) filters.push(`ordem_producao_id.eq.${scope.opId}`);
  if (scope.embarqueId) filters.push(`embarque_id.eq.${scope.embarqueId}`);
  if (scope.containerId) filters.push(`container_id.eq.${scope.containerId}`);
  if (scope.recebimentoId) filters.push(`recebimento_id.eq.${scope.recebimentoId}`);
  if (scope.ncId) filters.push(`nc_id.eq.${scope.ncId}`);
  if (scope.produtoCodigo) filters.push(`produto_codigo.eq.${scope.produtoCodigo}`);

  if (filters.length === 0) {
    return null;
  }
  if (filters.length === 1) {
    const [col, , val] = filters[0].split(/\.(eq)\./);
    return q.eq(col, val);
  }
  return q.or(filters.join(","));
}

function scopeKey(scope: ChinaTimelineScope): string {
  return JSON.stringify(scope);
}

function hasScope(scope: ChinaTimelineScope): boolean {
  return Boolean(
    scope.submissaoId ||
      scope.ocId ||
      scope.opId ||
      scope.embarqueId ||
      scope.containerId ||
      scope.recebimentoId ||
      scope.ncId ||
      scope.produtoCodigo,
  );
}

export function useChinaUnifiedTimeline(scope: ChinaTimelineScope) {
  const qc = useQueryClient();
  const enabled = hasScope(scope);

  // Realtime: invalidate on insert into china_timeline_eventos
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel(`cte-${scopeKey(scope)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "china_timeline_eventos" },
        () => {
          qc.invalidateQueries({ queryKey: ["china-unified-timeline", scopeKey(scope)] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, scope, qc]);

  return useQuery<ChinaTimelineEvent[]>({
    queryKey: ["china-unified-timeline", scopeKey(scope)],
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      const q = buildQuery(scope);
      if (!q) return [];
      const { data, error } = await q;
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        descricao: r.descricao,
        payload: r.payload || {},
        actor: inferActor(r.kind),
        actorLabel: r.actor_label,
        timestamp: r.created_at,
        refs: {
          submissaoId: r.submissao_id,
          ocId: r.ordem_compra_id,
          opId: r.ordem_producao_id,
          embarqueId: r.embarque_id,
          containerId: r.container_id,
          recebimentoId: r.recebimento_id,
          ncId: r.nc_id,
          documentoId: r.documento_id,
          produtoCodigo: r.produto_codigo,
        },
      }));
    },
  });
}
