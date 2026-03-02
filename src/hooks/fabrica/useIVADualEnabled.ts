import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook que lê a feature flag `iva_dual_habilitado` da config da empresa.
 * Quando false, toda a UI e cálculos IVA ficam ocultos.
 */
export function useIVADualEnabled() {
  const { data: enabled, isLoading } = useQuery({
    queryKey: ["iva-dual-enabled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_empresa_config")
        .select("iva_dual_habilitado")
        .maybeSingle();

      if (error) {
        console.error("Erro ao verificar flag IVA Dual:", error);
        return false;
      }

      return data?.iva_dual_habilitado === true;
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  return { enabled: enabled ?? false, isLoading };
}
