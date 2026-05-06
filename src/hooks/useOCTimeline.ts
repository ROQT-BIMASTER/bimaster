import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOCTimeline(ordemCompraId: string | null) {
  return useQuery({
    queryKey: ["oc-timeline", ordemCompraId],
    enabled: !!ordemCompraId,
    queryFn: async () => {
      const id = ordemCompraId!;
      const [oc, embarques, apontamentos, recebimentos, ncs, vinculos] = await Promise.all([
        supabase.from("china_ordens_compra" as any).select("*").eq("id", id).maybeSingle(),
        supabase.from("china_embarques" as any).select("*").eq("ordem_compra_id", id).order("data_embarque", { ascending: false }),
        supabase.from("china_producao_apontamentos" as any).select("*").eq("ordem_compra_id", id).order("data_producao", { ascending: false }).limit(20),
        supabase.from("china_recebimentos_carga" as any).select("*").eq("ordem_compra_id", id).order("data_chegada_porto", { ascending: false }),
        supabase.from("china_nao_conformidades" as any).select("*").eq("ordem_compra_id", id).order("created_at", { ascending: false }),
        supabase.from("compras_internacional_vinculos" as any).select("*").eq("china_ordem_compra_id", id),
      ]);
      return {
        oc: oc.data as any,
        embarques: (embarques.data || []) as any[],
        apontamentos: (apontamentos.data || []) as any[],
        recebimentos: (recebimentos.data || []) as any[],
        ncs: (ncs.data || []) as any[],
        vinculos: (vinculos.data || []) as any[],
      };
    },
    staleTime: 30_000,
  });
}
