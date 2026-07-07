import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UfYoyRow {
  uf: string;
  fat_atual: number;
  fat_anterior: number;
  notas_atual: number;
  variacao: number | null; // null se fat_anterior=0
  novo: boolean;
}

const sb = supabase as any;

export function useVendasUfYoy(p: {
  ano: number;
  mes?: number | null;
  empresa?: number | null;
  tabelaPrecoId?: number | null;
  clienteId?: number | null;
  vendedorId?: number | null;
}) {
  return useQuery({
    queryKey: [
      "vendas_uf_yoy", p.ano, p.mes ?? null, p.empresa ?? null,
      p.tabelaPrecoId ?? null, p.clienteId ?? null, p.vendedorId ?? null,
    ],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<UfYoyRow[]> => {
      const { data, error } = await sb.rpc("vendas_uf_yoy", {
        p_ano: p.ano,
        p_empresa: p.empresa ?? null,
        p_tabela_preco: p.tabelaPrecoId ?? null,
        p_cliente: p.clienteId ?? null,
        p_vendedor: p.vendedorId ?? null,
        p_mes: p.mes ?? null,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => {
        const atual = Number(r.fat_atual ?? 0);
        const ant = Number(r.fat_anterior ?? 0);
        const novo = ant === 0;
        return {
          uf: (r.uf ?? "—") as string,
          fat_atual: atual,
          fat_anterior: ant,
          notas_atual: Number(r.notas_atual ?? 0),
          variacao: novo ? null : atual / ant - 1,
          novo,
        };
      });
    },
  });
}
