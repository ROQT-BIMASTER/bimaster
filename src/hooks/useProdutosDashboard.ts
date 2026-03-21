import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "./useConfigOperacoes";
import type { DashboardFilters } from "./useDashboardKPIs";

export interface ProdutoData {
  produto: string;
  marca: string;
  receita: number;
  quantidade: number;
  pedidos: number;
  pctReceita: number;
  pctAcumulada: number;
  classificacao: "A" | "B" | "C";
}

export interface MarcaData {
  marca: string;
  receita: number;
  quantidade: number;
  pedidos: number;
  pctReceita: number;
}

export interface EmpresaMixData {
  empresa: string;
  marcas: { marca: string; receita: number }[];
  totalReceita: number;
}

export function useProdutosDashboard(filters: DashboardFilters) {
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers, loaded } = useOperacaoFilter();

  return useQuery({
    queryKey: ["produtos-dashboard", filters, empresaIds, [...visiveis]],
    queryFn: async () => {
      let q = supabase
        .from("vendas_union" as any)
        .select("produto, marca, pedido, operacao, venda, preco_venda, quantidade, id_empresa, tabela")
        .gte("data", `${filters.ano}-${String(filters.mes || 1).padStart(2, "0")}-01`);

      if (filters.mes) {
        const endMonth = filters.mes === 12 ? 1 : filters.mes + 1;
        const endYear = filters.mes === 12 ? filters.ano + 1 : filters.ano;
        q = q.lt("data", `${endYear}-${String(endMonth).padStart(2, "0")}-01`);
      } else {
        q = q.lt("data", `${filters.ano + 1}-01-01`);
      }

      if (empresaIds.length > 0) q = q.in("id_empresa", empresaIds);
      if (filters.supervisor) q = q.eq("supervisor", filters.supervisor);
      if (filters.codVend) q = q.eq("cod_vend", filters.codVend);
      if (filters.uf) q = q.eq("uf", filters.uf);
      if (filters.marca) q = q.eq("marca", filters.marca);
      if (filters.tabela) q = q.eq("tabela", filters.tabela);

      const { data, error } = await q.limit(50000);
      if (error) throw error;

      const rows = ((data as any[]) || []).filter(r => visiveis.has(r.operacao));

      // Aggregate by product
      const prodMap = new Map<string, { marca: string; receita: number; quantidade: number; pedidos: Set<string> }>();
      const marcaMap = new Map<string, { receita: number; quantidade: number; pedidos: Set<string> }>();
      const empresaMarcaMap = new Map<string, Map<string, number>>();
      let totalReceita = 0;

      for (const r of rows) {
        const mult = multipliers.get(r.operacao) ?? 1;
        const receita = (Number(r.venda) || (Number(r.preco_venda) || 0) * (Number(r.quantidade) || 0) || 0) * mult;
        const qtd = (Number(r.quantidade) || 0) * mult;
        totalReceita += receita;

        const prod = r.produto || "N/D";
        const marca = r.marca || "N/D";

        // Product
        if (!prodMap.has(prod)) prodMap.set(prod, { marca, receita: 0, quantidade: 0, pedidos: new Set() });
        const pe = prodMap.get(prod)!;
        pe.receita += receita;
        pe.quantidade += qtd;
        if (r.pedido) pe.pedidos.add(String(r.pedido));

        // Brand
        if (!marcaMap.has(marca)) marcaMap.set(marca, { receita: 0, quantidade: 0, pedidos: new Set() });
        const me = marcaMap.get(marca)!;
        me.receita += receita;
        me.quantidade += qtd;
        if (r.pedido) me.pedidos.add(String(r.pedido));

        // Enterprise mix
        const emp = String(r.id_empresa || "N/D");
        if (!empresaMarcaMap.has(emp)) empresaMarcaMap.set(emp, new Map());
        const emm = empresaMarcaMap.get(emp)!;
        emm.set(marca, (emm.get(marca) || 0) + receita);
      }

      // Products sorted by revenue for Pareto + ABC
      const produtos: ProdutoData[] = [...prodMap.entries()]
        .map(([produto, d]) => ({
          produto,
          marca: d.marca,
          receita: d.receita,
          quantidade: d.quantidade,
          pedidos: d.pedidos.size,
          pctReceita: totalReceita > 0 ? (d.receita / totalReceita) * 100 : 0,
          pctAcumulada: 0,
          classificacao: "C" as const,
        }))
        .sort((a, b) => b.receita - a.receita);

      // Calculate cumulative % and ABC
      let acumulada = 0;
      for (const p of produtos) {
        acumulada += p.pctReceita;
        p.pctAcumulada = acumulada;
        if (acumulada <= 80) p.classificacao = "A";
        else if (acumulada <= 95) p.classificacao = "B";
        else p.classificacao = "C";
      }

      // Brands
      const marcas: MarcaData[] = [...marcaMap.entries()]
        .map(([marca, d]) => ({
          marca,
          receita: d.receita,
          quantidade: d.quantidade,
          pedidos: d.pedidos.size,
          pctReceita: totalReceita > 0 ? (d.receita / totalReceita) * 100 : 0,
        }))
        .sort((a, b) => b.receita - a.receita);

      // Enterprise mix
      const empresaMix: EmpresaMixData[] = [...empresaMarcaMap.entries()]
        .map(([empresa, marcasMap]) => ({
          empresa,
          marcas: [...marcasMap.entries()].map(([marca, receita]) => ({ marca, receita })).sort((a, b) => b.receita - a.receita),
          totalReceita: [...marcasMap.values()].reduce((s, v) => s + v, 0),
        }))
        .sort((a, b) => b.totalReceita - a.totalReceita);

      return {
        produtos,
        marcas,
        empresaMix,
        totalReceita,
        totalProdutos: produtos.length,
        produtosA: produtos.filter(p => p.classificacao === "A").length,
        produtosB: produtos.filter(p => p.classificacao === "B").length,
        produtosC: produtos.filter(p => p.classificacao === "C").length,
      };
    },
    enabled: loaded,
    staleTime: 5 * 60 * 1000,
  });
}
