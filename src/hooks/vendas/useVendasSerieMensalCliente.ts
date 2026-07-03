import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SerieMensalPonto {
  mes: string;          // YYYY-MM-DD (primeiro dia do mês)
  faturamento: number;
  notas: number;
}

const sb = supabase as any;

export function useVendasSerieMensalCliente(clienteFuturaId: number | null | undefined) {
  return useQuery({
    queryKey: ["vendas_serie_mensal_cliente", clienteFuturaId],
    enabled: !!clienteFuturaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SerieMensalPonto[]> => {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - 24);
      desde.setDate(1);
      const p_desde = desde.toISOString().slice(0, 10);

      const { data, error } = await sb.rpc("vendas_serie_mensal_cliente", {
        p_cliente_futura_id: clienteFuturaId,
        p_desde,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        mes: String(r.mes),
        faturamento: Number(r.faturamento ?? 0),
        notas: Number(r.notas ?? 0),
      }));
    },
  });
}
