import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProdutoResumoResult = {
  produto_id: number;
  descricao: string | null;
  qtd_total: number;
  valor_total: number;
  meses_ativos: number;
  media_mensal: number;
  desvio_mensal: number | null;
  cv: number | null;
  classe_abc: "A" | "B" | "C";
  classe_xyz: "X" | "Y" | "Z";
};

export type SerieMensalPontoResult = {
  mes: string; // YYYY-MM-DD (1º do mês)
  quantidade: number;
  valor: number;
};

export function useVendasProdutoResumoResult(
  desde: string = "2025-01-01",
  empresa: number | null = null,
) {
  return useQuery({
    queryKey: ["vendas_produto_resumo_rubysp", desde, empresa],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendas_produto_resumo_rubysp", {
        p_desde: desde,
        ...(empresa !== null ? { p_empresa: empresa } : {}),
      } as never);
      if (error) throw error;
      return (data as unknown as ProdutoResumoResult[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSerieMensalProdutoResult(
  produtoId: number | null,
  desde: string = "2025-01-01",
) {
  return useQuery({
    queryKey: ["vendas_serie_mensal_produto_rubysp", produtoId, desde],
    enabled: produtoId !== null && produtoId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendas_serie_mensal_produto_rubysp", {
        p_produto_id: produtoId,
        p_desde: desde,
      } as never);
      if (error) throw error;
      return (data as unknown as SerieMensalPontoResult[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
