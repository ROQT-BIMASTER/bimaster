import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "./useConfigOperacoes";
import type { DashboardFilters } from "./useDashboardKPIs";

export interface UFData {
  uf: string;
  receita: number;
  pedidos: number;
  clientes: number;
  ticketMedio: number;
  pctTotal: number;
}

export interface CidadeData {
  cidade: string;
  uf: string;
  receita: number;
  pedidos: number;
  clientes: number;
  ticketMedio: number;
  pctTotal: number;
}

export function useGeograficoDashboard(filters: DashboardFilters) {
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers, loaded } = useOperacaoFilter();

  const query = useQuery({
    queryKey: ["geografico-dashboard", filters, empresaIds, [...visiveis]],
    queryFn: async () => {
      let q = supabase
        .from("vw_dashboard_kpis" as any)
        .select("*")
        .eq("ano", filters.ano);

      if (filters.mes) q = q.eq("mes", filters.mes);
      if (empresaIds.length > 0) q = q.in("id_empresa", empresaIds);
      if (filters.supervisor) q = q.eq("supervisor", filters.supervisor);
      if (filters.codVend) q = q.eq("cod_vend", filters.codVend);
      if (filters.marca) q = q.eq("marca", filters.marca);

      const { data, error } = await q;
      if (error) throw error;

      const rows = ((data as any[]) || []).filter(r => visiveis.has(r.operacao));

      // Aggregate by UF
      const ufMap = new Map<string, { receita: number; pedidos: number; clientes: Set<string>; clientCount: number }>();
      let totalReceita = 0;

      for (const r of rows) {
        const uf = r.uf || "N/D";
        const mult = multipliers.get(r.operacao) ?? 1;
        const receita = (Number(r.receita_total) || 0) * mult;
        totalReceita += receita;

        if (!ufMap.has(uf)) ufMap.set(uf, { receita: 0, pedidos: 0, clientes: new Set(), clientCount: 0 });
        const entry = ufMap.get(uf)!;
        entry.receita += receita;
        entry.pedidos += Number(r.qtde_pedidos) || 0;
        entry.clientCount += Number(r.clientes_ativos) || 0;
      }

      const ufData: UFData[] = [...ufMap.entries()]
        .map(([uf, d]) => ({
          uf,
          receita: d.receita,
          pedidos: d.pedidos,
          clientes: d.clientCount,
          ticketMedio: d.pedidos > 0 ? d.receita / d.pedidos : 0,
          pctTotal: totalReceita > 0 ? (d.receita / totalReceita) * 100 : 0,
        }))
        .sort((a, b) => b.receita - a.receita);

      // Concentration: top 5 vs rest
      const top5Receita = ufData.slice(0, 5).reduce((s, d) => s + d.receita, 0);
      const restReceita = totalReceita - top5Receita;

      // Coverage: all Brazilian UFs
      const allUFs = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
      const ufsComVenda = new Set(ufData.filter(d => d.receita > 0).map(d => d.uf));
      const ufsSemVenda = allUFs.filter(uf => !ufsComVenda.has(uf));

      return {
        ufData,
        totalReceita,
        top5Receita,
        restReceita,
        ufsSemVenda,
        ufsComVenda: ufsComVenda.size,
        totalUFs: allUFs.length,
      };
    },
    enabled: loaded,
    staleTime: 5 * 60 * 1000,
  });

  // Separate query for city-level data (from vendas_union directly)
  const cidadesQuery = useQuery({
    queryKey: ["geografico-cidades", filters, empresaIds, [...visiveis]],
    queryFn: async () => {
      // Use the view which has uf but not cidade — we need vendas_union directly
      let q = supabase
        .from("vendas_union" as any)
        .select("uf, cidade, cod_cliente, pedido, operacao, venda, preco_venda, quantidade")
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

      const { data, error } = await q.limit(50000);
      if (error) throw error;

      const rows = ((data as any[]) || []).filter(r => visiveis.has(r.operacao));
      const cidadeMap = new Map<string, { receita: number; pedidos: Set<string>; clientes: Set<string>; uf: string }>();
      let totalReceita = 0;

      for (const r of rows) {
        const key = `${r.cidade || "N/D"}|${r.uf || "N/D"}`;
        const mult = multipliers.get(r.operacao) ?? 1;
        const receita = (Number(r.venda) || (Number(r.preco_venda) || 0) * (Number(r.quantidade) || 0) || 0) * mult;
        totalReceita += receita;

        if (!cidadeMap.has(key)) cidadeMap.set(key, { receita: 0, pedidos: new Set(), clientes: new Set(), uf: r.uf || "N/D" });
        const entry = cidadeMap.get(key)!;
        entry.receita += receita;
        if (r.pedido) entry.pedidos.add(String(r.pedido));
        if (r.cod_cliente) entry.clientes.add(String(r.cod_cliente));
      }

      const cidadeData: CidadeData[] = [...cidadeMap.entries()]
        .map(([key, d]) => {
          const cidade = key.split("|")[0];
          return {
            cidade,
            uf: d.uf,
            receita: d.receita,
            pedidos: d.pedidos.size,
            clientes: d.clientes.size,
            ticketMedio: d.pedidos.size > 0 ? d.receita / d.pedidos.size : 0,
            pctTotal: totalReceita > 0 ? (d.receita / totalReceita) * 100 : 0,
          };
        })
        .sort((a, b) => b.receita - a.receita);

      return cidadeData;
    },
    enabled: loaded,
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query.data,
    cidades: cidadesQuery.data || [],
    isLoading: query.isLoading || cidadesQuery.isLoading,
  };
}
