import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";

export interface ClienteSerieMensalPoint {
  mes: Date;
  faturamento: number;
  quantidade: number;
  notas: number;
}

const sb = supabase as any;

export function useClienteSerieMensal(
  clienteFuturaId: number | null | undefined,
  desde: string | null = "2024-01-01",
  enabled = true,
) {
  return useQuery({
    queryKey: ["vendas-serie-mensal-cliente", clienteFuturaId, desde],
    queryFn: async (): Promise<ClienteSerieMensalPoint[]> => {
      if (!clienteFuturaId) return [];
      const { data, error } = await sb.rpc("vendas_serie_mensal_cliente", {
        p_cliente_futura_id: clienteFuturaId,
        p_desde: desde,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        mes: parseLocalDate(r.mes) ?? new Date(r.mes),
        faturamento: Number(r.faturamento ?? 0),
        quantidade: Number(r.quantidade ?? 0),
        notas: Number(r.notas ?? 0),
      }));
    },
    enabled: Boolean(clienteFuturaId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
