import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProdutoResumo = {
  cod_produto: string;
  descricao: string | null;
  marca: string | null;
  nome_linha: string | null;
  meses_no_periodo: number;
  meses_com_venda: number;
  qtd_total: number;
  valor_total: number;
  media_mensal: number;
  desvio_mensal: number | null;
  cv: number | null;
  classe_abc: "A" | "B" | "C";
  classe_xyz: "X" | "Y" | "Z";
  estoque_atual: number;
};

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export type Janela = "12m" | "24m" | "since-2024";

export function janelaToRange(j: Janela): { ini: string; fim: string } {
  const today = new Date();
  const fim = toIsoDate(today);
  if (j === "since-2024") return { ini: "2024-01-01", fim };
  const meses = j === "12m" ? 12 : 24;
  const ini = new Date(today);
  ini.setMonth(ini.getMonth() - meses);
  ini.setDate(1);
  return { ini: toIsoDate(ini), fim };
}

export function useVendasProdutoResumo(janela: Janela) {
  const { ini, fim } = janelaToRange(janela);
  return useQuery({
    queryKey: ["vendas_produto_resumo", ini, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendas_produto_resumo", {
        p_data_ini: ini,
        p_data_fim: fim,
      } as never);
      if (error) throw error;
      return (data as unknown as ProdutoResumo[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type SerieMensalPonto = {
  mes: string; // YYYY-MM-DD (1º do mês)
  quantidade: number;
  valor: number;
};

export function useSerieMensalProduto(codProduto: string | null, dataIni = "2024-01-01") {
  const today = new Date();
  const fim = toIsoDate(today);
  return useQuery({
    queryKey: ["vendas_serie_mensal_produto", codProduto, dataIni, fim],
    enabled: !!codProduto,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vendas_serie_mensal_produto", {
        p_cod_produto: codProduto,
        p_data_ini: dataIni,
        p_data_fim: fim,
      } as never);
      if (error) throw error;
      return (data as unknown as SerieMensalPonto[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
