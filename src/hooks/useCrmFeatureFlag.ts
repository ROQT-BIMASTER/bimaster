import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lê feature flag do CRM por empresa. Default: desligada (fail-closed).
 */
export function useCrmFeatureFlag(empresaId: number | undefined | null, flag: string) {
  const { data } = useQuery({
    queryKey: ["crm-flag", empresaId, flag],
    enabled: !!empresaId && !!flag,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("crm_feature_flags")
        .select("ativo")
        .eq("empresa_id", empresaId!)
        .eq("flag", flag)
        .maybeSingle();
      if (error) return false;
      return !!data?.ativo;
    },
  });
  return !!data;
}
