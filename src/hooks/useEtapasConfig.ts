import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ETAPAS_CICLO_VIDA } from "@/hooks/useProductProcess";

export interface EtapaConfig {
  id: string;
  produto_tipo: string;
  etapa_key: string;
  etapa_label: string;
  ordem: number;
}

const QUERY_KEY = "process-etapas-config";

/**
 * Hook to fetch and manage configurable stage ordering per product type.
 * Falls back to hardcoded ETAPAS_CICLO_VIDA if no DB config exists.
 */
export function useEtapasConfig(produtoTipo?: string) {
  const queryClient = useQueryClient();

  const { data: allEtapas = [], isLoading } = useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_etapas_config" as any)
        .select("*")
        .order("ordem", { ascending: true }) as any);
      if (error) throw error;
      return (data || []) as EtapaConfig[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Etapas for a specific type, with fallback
  const etapasForTipo = (tipo: string): EtapaConfig[] => {
    const fromDb = allEtapas.filter(e => e.produto_tipo === tipo).sort((a, b) => a.ordem - b.ordem);
    if (fromDb.length > 0) return fromDb;
    // Fallback to hardcoded
    return ETAPAS_CICLO_VIDA.map((e, i) => ({
      id: `fallback-${e.key}`,
      produto_tipo: tipo,
      etapa_key: e.key,
      etapa_label: e.label,
      ordem: e.ordem,
    }));
  };

  const etapas = produtoTipo ? etapasForTipo(produtoTipo) : [];

  // Reorder mutation
  const reorderEtapas = useMutation({
    mutationFn: async (params: { produtoTipo: string; orderedKeys: string[] }) => {
      const updates = params.orderedKeys.map((key, idx) =>
        (supabase
          .from("process_etapas_config" as any)
          .update({ ordem: idx + 1, updated_at: new Date().toISOString() })
          .eq("produto_tipo", params.produtoTipo)
          .eq("etapa_key", key) as any)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });

  return {
    allEtapas,
    etapas,
    etapasForTipo,
    isLoading,
    reorderEtapas,
  };
}
