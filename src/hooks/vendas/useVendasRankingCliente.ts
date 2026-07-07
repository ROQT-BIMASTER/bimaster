import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VendasSource } from "@/hooks/useVendasAnalise";

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
  source?: VendasSource;
}) {
  const source: VendasSource = p.source ?? "futura";
  const rpc = source === "rubysp" ? "vendas_ranking_cliente_rubysp" : "vendas_ranking_cliente";
  return useQuery({
    queryKey: [
      "vendas_ranking_cliente", source,
      p.de, p.ate, p.empresa ?? null,
      p.tabelaPrecoId ?? null, p.uf ?? null, p.clienteId ?? null, p.vendedorId ?? null,
      p.limite ?? null,
    ],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<VendasClienteRow[]> => {
      const params = source === "rubysp"
        ? {
            p_de: p.de,
            p_ate: p.ate,
            p_empresa: p.empresa ?? null,
            p_vendedor: p.vendedorId ?? null,
            p_limite: p.limite ?? null,
          }
        : {
            p_de: p.de,
            p_ate: p.ate,
            p_empresa: p.empresa ?? null,
            p_tabela_preco: p.tabelaPrecoId ?? null,
            p_uf: p.uf ?? null,
            p_cliente: p.clienteId ?? null,
            p_vendedor: p.vendedorId ?? null,
          };
      const { data, error } = await sb.rpc(rpc, params);
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

