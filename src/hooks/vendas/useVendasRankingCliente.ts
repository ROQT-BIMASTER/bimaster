import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VendasClienteRow {
  cliente_id: number | null;
  cliente_nome: string;
  notas: number;
  faturamento: number;
  ticket_medio: number;
}

const sb = supabase as any;

export function useVendasRankingCliente(p: {
  de: string | null;
  ate: string | null;
  empresa?: number | null;
}) {
  return useQuery({
    queryKey: ["vendas_ranking_cliente", p.de, p.ate, p.empresa ?? null],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<VendasClienteRow[]> => {
      const { data, error } = await sb.rpc("vendas_ranking_cliente", {
        p_de: p.de,
        p_ate: p.ate,
        p_empresa: p.empresa ?? null,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        cliente_id: r.cliente_id ?? null,
        cliente_nome: r.cliente_nome ?? "—",
        notas: Number(r.notas ?? 0),
        faturamento: Number(r.faturamento ?? 0),
        ticket_medio: Number(r.ticket_medio ?? 0),
      }));
    },
  });
}
