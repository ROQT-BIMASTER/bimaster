import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CenarioProduto } from "@/hooks/useGrupoCenarios";
import type { CenarioCustoAgg, CustoItemFull } from "@/components/fabrica/analises/analises-utils";

/**
 * Carrega custos completos (insumos + IPI + Made In + mão de obra + markup config) de uma lista de produtos
 * e agrega no formato CenarioCustoAgg consumido pelas análises.
 */
export function useCenariosCustosCompletos(cenarios: CenarioProduto[]) {
  const ids = cenarios.map((c) => c.id).sort();
  return useQuery<CenarioCustoAgg[]>({
    queryKey: ["fabrica-cenarios-custos-completos", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: custos, error: e1 }, { data: configs, error: e2 }] = await Promise.all([
        supabase
          .from("fabrica_produto_custos")
          .select("produto_id, codigo, nome, fornecedor, tipo_insumo, custo_nf, custo_servico, custo_condicao, custo_nf_made_in, ipi_valor, nf_referencia, ordem")
          .in("produto_id", ids)
          .order("ordem", { ascending: true }),
        supabase
          .from("fabrica_produto_custos_config")
          .select("produto_id, custo_mao_obra_nf, custo_mao_obra_servico, percentual_markup")
          .in("produto_id", ids),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const configMap = new Map<string, { mao_nf: number; mao_serv: number; markup: number }>();
      (configs ?? []).forEach((c: any) => {
        configMap.set(c.produto_id, {
          mao_nf: Number(c.custo_mao_obra_nf || 0),
          mao_serv: Number(c.custo_mao_obra_servico || 0),
          markup: Number(c.percentual_markup || 0),
        });
      });

      const byProduto = new Map<string, CustoItemFull[]>();
      (custos ?? []).forEach((row: any) => {
        const lista = byProduto.get(row.produto_id) ?? [];
        lista.push({
          produto_id: row.produto_id,
          codigo: row.codigo,
          nome: row.nome,
          fornecedor: row.fornecedor,
          tipo_insumo: row.tipo_insumo,
          custo_nf: Number(row.custo_nf || 0),
          custo_servico: Number(row.custo_servico || 0),
          custo_condicao: Number(row.custo_condicao || 0),
          custo_nf_made_in: Number(row.custo_nf_made_in || 0),
          ipi_valor: Number(row.ipi_valor || 0),
          nf_referencia: row.nf_referencia,
        });
        byProduto.set(row.produto_id, lista);
      });

      return cenarios.map<CenarioCustoAgg>((c) => {
        const itens = byProduto.get(c.id) ?? [];
        const totalNF = itens.reduce((s, i) => s + i.custo_nf, 0);
        const totalServico = itens.reduce((s, i) => s + i.custo_servico, 0);
        const totalCondicao = itens.reduce((s, i) => s + i.custo_condicao, 0);
        const totalNFMadeIn = itens.reduce((s, i) => s + i.custo_nf_made_in, 0);
        const ipiTotal = itens.reduce((s, i) => s + i.ipi_valor, 0);
        const totalInsumos = totalNF + totalServico + totalCondicao;
        const cfg = configMap.get(c.id) ?? { mao_nf: 0, mao_serv: 0, markup: 0 };
        const subtotal = totalInsumos + cfg.mao_nf + cfg.mao_serv + ipiTotal + totalNFMadeIn;
        const custoFinal = subtotal * (1 + (cfg.markup || 0) / 100);
        return {
          produto: c,
          itens,
          totalInsumos,
          ipiTotal,
          totalNF,
          totalServico,
          totalCondicao,
          totalNFMadeIn,
          custoMaoObraNF: cfg.mao_nf,
          custoMaoObraServico: cfg.mao_serv,
          custoFinal,
        };
      });
    },
  });
}
