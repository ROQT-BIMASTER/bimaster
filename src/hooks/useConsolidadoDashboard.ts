import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "./useConfigOperacoes";
import type { DashboardFilters } from "./useDashboardKPIs";

export interface EmpresaConsolidado {
  id_empresa: number;
  nome_empresa: string;
  receitaMes: number;
  receitaMesAnterior: number;
  variacao: number;
  pedidos: number;
  clientes: number;
  ticketMedio: number;
  pctTotal: number;
}

export interface EmpresaTendencia {
  label: string;
  [key: string]: number | string;
}

export function useConsolidadoDashboard(filters: DashboardFilters) {
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers, loaded } = useOperacaoFilter();

  return useQuery({
    queryKey: ["consolidado-dashboard", filters, empresaIds, [...visiveis]],
    queryFn: async () => {
      // Fetch current period
      let q = supabase.from("vw_receita_empresa" as any).select("*").eq("ano", filters.ano);
      if (filters.mes) q = q.eq("mes", filters.mes);

      const { data: current, error: e1 } = await q;
      if (e1) throw e1;

      // Fetch previous period
      const prevFilters = { ...filters };
      if (filters.mes) {
        if (filters.mes === 1) { prevFilters.ano = filters.ano - 1; prevFilters.mes = 12; }
        else { prevFilters.mes = filters.mes - 1; }
      } else {
        prevFilters.ano = filters.ano - 1;
      }
      let q2 = supabase.from("vw_receita_empresa" as any).select("*").eq("ano", prevFilters.ano);
      if (prevFilters.mes) q2 = q2.eq("mes", prevFilters.mes);

      const { data: prev, error: e2 } = await q2;
      if (e2) throw e2;

      // Fetch KPI view for clientes count
      let kq = supabase.from("vw_dashboard_kpis" as any).select("id_empresa,clientes_ativos,qtde_pedidos,operacao").eq("ano", filters.ano);
      if (filters.mes) kq = kq.eq("mes", filters.mes);
      const { data: kpiData } = await kq;

      const curRows = ((current as any[]) || []).filter(r => visiveis.has(r.operacao));
      const prevRows = ((prev as any[]) || []).filter(r => visiveis.has(r.operacao));
      const kpiRows = ((kpiData as any[]) || []).filter(r => visiveis.has(r.operacao));

      // Aggregate current
      const empMap = new Map<number, { nome: string; receita: number; pedidos: number; clientes: number }>();
      let totalReceita = 0;

      for (const r of curRows) {
        const id = r.id_empresa;
        const mult = multipliers.get(r.operacao) ?? 1;
        const receita = (Number(r.receita_total) || 0) * mult;
        totalReceita += receita;
        if (!empMap.has(id)) empMap.set(id, { nome: r.nome_empresa || `Empresa ${id}`, receita: 0, pedidos: 0, clientes: 0 });
        empMap.get(id)!.receita += receita;
        empMap.get(id)!.pedidos += Number(r.qtde_pedidos) || 0;
      }

      // Add clientes from KPI view
      for (const r of kpiRows) {
        const id = r.id_empresa;
        const mult = multipliers.get(r.operacao) ?? 1;
        if (empMap.has(id)) {
          empMap.get(id)!.clientes += Number(r.clientes_ativos) || 0;
        }
      }

      // Aggregate previous
      const prevMap = new Map<number, number>();
      for (const r of prevRows) {
        const mult = multipliers.get(r.operacao) ?? 1;
        prevMap.set(r.id_empresa, (prevMap.get(r.id_empresa) || 0) + (Number(r.receita_total) || 0) * mult);
      }

      const empresas: EmpresaConsolidado[] = [...empMap.entries()]
        .map(([id, d]) => {
          const prevReceita = prevMap.get(id) || 0;
          return {
            id_empresa: id,
            nome_empresa: d.nome,
            receitaMes: d.receita,
            receitaMesAnterior: prevReceita,
            variacao: prevReceita > 0 ? ((d.receita - prevReceita) / prevReceita) * 100 : d.receita > 0 ? 100 : 0,
            pedidos: d.pedidos,
            clientes: d.clientes,
            ticketMedio: d.pedidos > 0 ? d.receita / d.pedidos : 0,
            pctTotal: totalReceita > 0 ? (d.receita / totalReceita) * 100 : 0,
          };
        })
        .sort((a, b) => b.receitaMes - a.receitaMes);

      // 12-month trend per empresa
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      let trendQ = supabase.from("vw_receita_empresa" as any).select("*").in("ano", [filters.ano, filters.ano - 1]);
      const { data: trendData } = await trendQ;
      const trendRows = ((trendData as any[]) || []).filter(r => visiveis.has(r.operacao));

      const trendMap = new Map<string, Map<string, number>>();
      for (const r of trendRows) {
        const key = `${r.ano}-${String(r.mes).padStart(2, "0")}`;
        const nome = r.nome_empresa || `Emp ${r.id_empresa}`;
        const mult = multipliers.get(r.operacao) ?? 1;
        if (!trendMap.has(key)) trendMap.set(key, new Map());
        const m = trendMap.get(key)!;
        m.set(nome, (m.get(nome) || 0) + (Number(r.receita_total) || 0) * mult);
      }

      const meses: { ano: number; mes: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        let m = (filters.mes || new Date().getMonth() + 1) - i;
        let y = filters.ano;
        while (m <= 0) { m += 12; y--; }
        meses.push({ ano: y, mes: m });
      }

      const empNames = [...new Set(empresas.map(e => e.nome_empresa))];
      const tendencia: EmpresaTendencia[] = meses.map(({ ano, mes }) => {
        const key = `${ano}-${String(mes).padStart(2, "0")}`;
        const entry: EmpresaTendencia = { label: `${monthNames[mes - 1]}/${String(ano).slice(2)}` };
        const monthData = trendMap.get(key);
        for (const nome of empNames) {
          entry[nome] = monthData?.get(nome) || 0;
        }
        return entry;
      });

      // YoY comparison
      let yoyQ = supabase.from("vw_receita_empresa" as any).select("*").eq("ano", filters.ano - 1);
      if (filters.mes) yoyQ = yoyQ.eq("mes", filters.mes);
      const { data: yoyData } = await yoyQ;
      const yoyRows = ((yoyData as any[]) || []).filter(r => visiveis.has(r.operacao));
      const yoyMap = new Map<number, number>();
      for (const r of yoyRows) {
        const mult = multipliers.get(r.operacao) ?? 1;
        yoyMap.set(r.id_empresa, (yoyMap.get(r.id_empresa) || 0) + (Number(r.receita_total) || 0) * mult);
      }

      return {
        empresas,
        totalReceita,
        tendencia,
        empNames,
        yoyMap,
      };
    },
    enabled: loaded,
    staleTime: 5 * 60 * 1000,
  });
}
