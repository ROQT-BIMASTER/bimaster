import { useQuery } from "@tanstack/react-query";
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

/**
 * Carrega o histórico de despacho/encaminhamento (process_events) de uma
 * submissão China — resolve o process_id correspondente automaticamente.
 */
export function useDispatchHistory(submissaoId: string | null) {
  return useQuery({
    queryKey: ["china-dispatch-history", submissaoId],
    enabled: !!submissaoId,
    staleTime: 15_000,
    queryFn: async (): Promise<ProcessEventRow[]> => {
      if (!submissaoId) return [];
      const { data: proc } = await (supabase
        .from("product_process" as any)
        .select("id")
        .eq("produto_tipo", "china")
        .eq("produto_ref_id", submissaoId)
        .maybeSingle() as any);
      const pid: string | null = proc?.id ?? null;
      if (!pid) return [];
      const { data } = await (supabase
        .from("process_events" as any)
        .select("*")
        .eq("process_id", pid)
        .order("created_at", { ascending: false })
        .limit(50) as any);
      return (data ?? []) as ProcessEventRow[];
    },
  });
}
