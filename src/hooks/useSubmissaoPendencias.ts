import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PendenciaInfo {
  total: number;
  pendentes: number;
}

export function useSubmissaoPendencias(submissaoIds: string[]) {
  return useQuery({
    queryKey: ["submissao-pendencias", submissaoIds],
    enabled: submissaoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc("get_pendencias_por_submissao", {
        p_ids: submissaoIds,
      }) as any);
      if (error) throw error;
      const map = new Map<string, PendenciaInfo>();
      (data || []).forEach((row: any) => {
        map.set(row.submissao_id, { total: row.total, pendentes: row.pendentes });
      });
      return map;
    },
    staleTime: 2 * 60 * 1000,
  });
}
