import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EMPTY_SLA, type SlaConfig } from "@/lib/china/timelineSlaCompute";

interface Row extends SlaConfig {
  id: string;
  submissao_id: string | null;
}

/**
 * Carrega o SLA efetivo (override por submissão se existir, senão template global).
 * Retorna também ambos para a UI poder mostrar "qual está em uso".
 */
export function useChinaTimelineSla(submissaoId: string | null | undefined) {
  return useQuery({
    queryKey: ["china-timeline-sla", submissaoId ?? null],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: globalRow } = await (supabase as any)
        .from("china_timeline_sla")
        .select("*")
        .is("submissao_id", null)
        .maybeSingle();

      let overrideRow: Row | null = null;
      if (submissaoId) {
        const r = await (supabase as any)
          .from("china_timeline_sla")
          .select("*")
          .eq("submissao_id", submissaoId)
          .maybeSingle();
        overrideRow = (r.data as Row | null) ?? null;
      }

      const effective: SlaConfig =
        (overrideRow as SlaConfig | null) ??
        (globalRow as SlaConfig | null) ??
        EMPTY_SLA;

      return {
        global: (globalRow as Row | null) ?? null,
        override: overrideRow,
        effective,
        usingOverride: !!overrideRow,
      };
    },
  });
}

export function useUpsertChinaTimelineSla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      submissaoId: string | null;
      values: SlaConfig;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado.");
      const row = {
        submissao_id: payload.submissaoId,
        ...payload.values,
        updated_by: user.id,
      };
      // upsert manual: tenta update, depois insert.
      const filter = payload.submissaoId
        ? (supabase as any).from("china_timeline_sla").update(row).eq("submissao_id", payload.submissaoId)
        : (supabase as any).from("china_timeline_sla").update(row).is("submissao_id", null);
      const { data: updated, error: upErr } = await filter.select("*").maybeSingle();
      if (upErr) throw upErr;
      if (updated) return updated;
      const { error: insErr } = await (supabase as any)
        .from("china_timeline_sla")
        .insert(row);
      if (insErr) throw insErr;
      return row;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["china-timeline-sla"] });
      qc.invalidateQueries({ queryKey: ["china-timeline-sla", vars.submissaoId ?? null] });
    },
  });
}

export function useDeleteChinaTimelineSlaOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (submissaoId: string) => {
      const { error } = await (supabase as any)
        .from("china_timeline_sla")
        .delete()
        .eq("submissao_id", submissaoId);
      if (error) throw error;
    },
    onSuccess: (_d, sid) => {
      qc.invalidateQueries({ queryKey: ["china-timeline-sla", sid] });
      qc.invalidateQueries({ queryKey: ["china-timeline-sla"] });
    },
  });
}
