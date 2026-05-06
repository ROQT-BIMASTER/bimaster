import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProcessEventRow {
  id: string;
  process_id: string;
  tipo_evento: string;
  modulo_origem: string;
  descricao: string | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  metadata: Record<string, any> | null;
  ref_entity_id: string | null;
  ref_entity_table: string | null;
  created_at: string;
}

export const DISPATCH_PAGE_SIZE = 25;

/**
 * Carrega o histórico de despacho/encaminhamento (process_events) de uma
 * submissão China com paginação cursor-based por `created_at`.
 */
export function useDispatchHistory(submissaoId: string | null) {
  return useInfiniteQuery({
    queryKey: ["china-dispatch-history", submissaoId],
    enabled: !!submissaoId,
    staleTime: 15_000,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<{ rows: ProcessEventRow[]; nextCursor: string | null }> => {
      if (!submissaoId) return { rows: [], nextCursor: null };
      const { data: proc } = await (supabase
        .from("product_process" as any)
        .select("id")
        .eq("produto_tipo", "china")
        .eq("produto_ref_id", submissaoId)
        .maybeSingle() as any);
      const pid: string | null = proc?.id ?? null;
      if (!pid) return { rows: [], nextCursor: null };

      let query = (supabase
        .from("process_events" as any)
        .select("*")
        .eq("process_id", pid)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(DISPATCH_PAGE_SIZE) as any);

      if (pageParam) query = query.lt("created_at", pageParam);

      const { data } = await (query as any);
      const rows = (data ?? []) as ProcessEventRow[];
      const nextCursor = rows.length === DISPATCH_PAGE_SIZE ? rows[rows.length - 1].created_at : null;
      return { rows, nextCursor };
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}
