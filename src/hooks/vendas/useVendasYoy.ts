import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VendasSource } from "@/hooks/useVendasAnalise";

export type YoyDim = "cliente" | "vendedor";

export interface VendasYoyRow {
  chave: number | null;
  nome: string;
  fat_atual: number;
  fat_anterior: number;
  variacao: number | null; // fat_atual / fat_anterior - 1 (null se fat_anterior = 0)
  notas_atual: number;
  novo: boolean;           // fat_anterior === 0
}

const sb = supabase as any;

export function useVendasYoy(p: {
  dim: YoyDim;
  ano: number;
  mes?: number | null;
  empresa?: number | null;
  tabelaPrecoId?: number | null;
  uf?: string | null;
  clienteId?: number | null;
  vendedorId?: number | null;
  source?: VendasSource;
}) {
  const source: VendasSource = p.source ?? "futura";
  const rpc = source === "rubysp" ? "vendas_yoy_por_dimensao_rubysp" : "vendas_yoy_por_dimensao";
  return useQuery({
    queryKey: [
      "vendas_yoy_por_dimensao", source, p.dim, p.ano, p.mes ?? null, p.empresa ?? null,
      p.tabelaPrecoId ?? null, p.uf ?? null, p.clienteId ?? null, p.vendedorId ?? null,
    ],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<VendasYoyRow[]> => {
      const params = source === "rubysp"
        ? { p_dim: p.dim, p_ano: p.ano, p_empresa: p.empresa ?? null }
        : {
            p_dim: p.dim,
            p_ano: p.ano,
            p_empresa: p.empresa ?? null,
            p_tabela_preco: p.tabelaPrecoId ?? null,
            p_uf: p.uf ?? null,
            p_cliente: p.clienteId ?? null,
            p_vendedor: p.vendedorId ?? null,
            p_mes: p.mes ?? null,
          };
      const { data, error } = await sb.rpc(rpc, params);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => {
        const atual = Number(r.fat_atual ?? 0);
        const ant = Number(r.fat_anterior ?? 0);
        const novo = ant === 0;
        const variacao = novo ? null : atual / ant - 1;
        const chaveRaw = r.chave;
        const chaveNum = chaveRaw == null || chaveRaw === "" ? null : Number(chaveRaw);
        return {
          chave: Number.isFinite(chaveNum as number) ? (chaveNum as number) : null,
          nome: r.nome ?? "—",
          fat_atual: atual,
          fat_anterior: ant,
          variacao,
          notas_atual: Number(r.notas_atual ?? 0),
          novo,
        };
      });
    },
  });
}

