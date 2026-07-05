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
  tabelaPrecoId?: number | null;
  uf?: string | null;
  clienteId?: number | null;
  vendedorId?: number | null;
  limite?: number | null;
}) {
  return useQuery({
    queryKey: [
      "vendas_ranking_cliente_rubysp",
      p.de, p.ate, p.empresa ?? null,
      p.tabelaPrecoId ?? null, p.uf ?? null, p.clienteId ?? null, p.vendedorId ?? null,
      p.limite ?? null,
    ],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<VendasClienteRow[]> => {
      const { data, error } = await sb.rpc("vendas_ranking_cliente_rubysp", {
        p_de: p.de,
        p_ate: p.ate,
        p_empresa: p.empresa ?? null,
        p_vendedor: p.vendedorId ?? null,
        p_limite: p.limite ?? null,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => {
        const notas = Number(r.notas ?? 0);
        const fat = Number(r.faturamento ?? 0);
        return {
          cliente_id: r.cliente_id ?? null,
          cliente_nome: r.cliente_nome ?? "—",
          notas,
          faturamento: fat,
          ticket_medio: notas > 0 ? fat / notas : 0,
        };
      });
    },
  });
}
