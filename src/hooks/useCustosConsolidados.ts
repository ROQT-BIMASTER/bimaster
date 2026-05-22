import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CenarioProduto } from "@/hooks/useGrupoCenarios";
import type { CustoItemFull } from "@/components/fabrica/analises/analises-utils";

export interface ProdutoConsolidado {
  produto: CenarioProduto;
  grupoId: string | null;
  grupoNome: string;
  itens: CustoItemFull[];
  totalInsumos: number;
  ipiTotal: number;
  totalNF: number;
  totalServico: number;
  totalCondicao: number;
  totalNFMadeIn: number;
  custoMaoObraNF: number;
  custoMaoObraServico: number;
  percentualMarkup: number;
  custoFinal: number;
  custoFinalSim01: number | null; // primeiro produto do mesmo grupo
}

const PROD_COLS =
  "id, codigo, nome, cenario_label, grupo_cenario_id, modo, tipo, marca, linha, foto_url, custo_unitario, preco_minimo, preco_maximo, created_at, created_by, ativo";

/**
 * Carrega todos os produtos da Fábrica com seus custos agregados e calcula
 * o custo final (com markup e mão de obra) por produto, anexando também o
 * custo do primeiro produto do mesmo grupo (Sim01) para análise de Δ.
 */
export function useCustosConsolidados() {
  return useQuery<ProdutoConsolidado[]>({
    queryKey: ["fabrica-custos-consolidados-v1"],
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: produtos, error: e1 }, { data: custos, error: e2 }, { data: configs, error: e3 }] =
        await Promise.all([
          supabase.from("fabrica_produtos").select(PROD_COLS).order("created_at", { ascending: true }),
          supabase
            .from("fabrica_produto_custos")
            .select(
              "produto_id, codigo, nome, fornecedor, tipo_insumo, custo_nf, custo_servico, custo_condicao, custo_nf_made_in, ipi_valor, nf_referencia, ordem",
            )
            .order("ordem", { ascending: true }),
          supabase
            .from("fabrica_produto_custos_config")
            .select("produto_id, custo_mao_obra_nf, custo_mao_obra_servico, percentual_markup"),
        ]);
      if (e1) throw e1;
      if (e2) throw e2;
      if (e3) throw e3;

      const configMap = new Map<string, { mao_nf: number; mao_serv: number; markup: number }>();
      (configs ?? []).forEach((c: any) => {
        configMap.set(c.produto_id, {
          mao_nf: Number(c.custo_mao_obra_nf || 0),
          mao_serv: Number(c.custo_mao_obra_servico || 0),
          markup: Number(c.percentual_markup || 0),
        });
      });

      const itensMap = new Map<string, CustoItemFull[]>();
      (custos ?? []).forEach((row: any) => {
        const list = itensMap.get(row.produto_id) ?? [];
        list.push({
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
        itensMap.set(row.produto_id, list);
      });

      function agregar(p: CenarioProduto): Omit<ProdutoConsolidado, "produto" | "grupoId" | "grupoNome" | "custoFinalSim01"> {
        const itens = itensMap.get(p.id) ?? [];
        const totalNF = itens.reduce((s, i) => s + i.custo_nf, 0);
        const totalServico = itens.reduce((s, i) => s + i.custo_servico, 0);
        const totalCondicao = itens.reduce((s, i) => s + i.custo_condicao, 0);
        const totalNFMadeIn = itens.reduce((s, i) => s + i.custo_nf_made_in, 0);
        const ipiTotal = itens.reduce((s, i) => s + i.ipi_valor, 0);
        const totalInsumos = totalNF + totalServico + totalCondicao;
        const cfg = configMap.get(p.id) ?? { mao_nf: 0, mao_serv: 0, markup: 0 };
        const subtotal = totalInsumos + cfg.mao_nf + cfg.mao_serv + ipiTotal + totalNFMadeIn;
        const custoFinal = subtotal * (1 + (cfg.markup || 0) / 100);
        return {
          itens,
          totalInsumos,
          ipiTotal,
          totalNF,
          totalServico,
          totalCondicao,
          totalNFMadeIn,
          custoMaoObraNF: cfg.mao_nf,
          custoMaoObraServico: cfg.mao_serv,
          percentualMarkup: cfg.markup,
          custoFinal,
        };
      }

      // Primeiro custo final por grupo (Sim01)
      const sim01PorGrupo = new Map<string, number>();
      const prods = (produtos ?? []) as CenarioProduto[];
      prods.forEach((p) => {
        if (!p.grupo_cenario_id) return;
        if (!sim01PorGrupo.has(p.grupo_cenario_id)) {
          sim01PorGrupo.set(p.grupo_cenario_id, agregar(p).custoFinal);
        }
      });

      // Nome do grupo = nome do primeiro produto do grupo
      const nomeGrupo = new Map<string, string>();
      prods.forEach((p) => {
        const gid = p.grupo_cenario_id;
        if (gid && !nomeGrupo.has(gid)) nomeGrupo.set(gid, p.nome || gid.slice(0, 8));
      });

      return prods.map<ProdutoConsolidado>((p) => {
        const agg = agregar(p);
        const sim01 = p.grupo_cenario_id ? sim01PorGrupo.get(p.grupo_cenario_id) ?? null : null;
        return {
          produto: p,
          grupoId: p.grupo_cenario_id,
          grupoNome: p.grupo_cenario_id ? nomeGrupo.get(p.grupo_cenario_id) ?? "—" : "(sem grupo)",
          custoFinalSim01: sim01,
          ...agg,
        };
      });
    },
  });
}
