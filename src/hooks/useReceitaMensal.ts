import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "./useConfigOperacoes";
import type { DashboardFilters } from "./useDashboardKPIs";

interface ReceitaMensal {
  ano: number;
  mes: number;
  receita_total: number;
  label: string;
}

export function useReceitaMensal(filters: DashboardFilters) {
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers, loaded } = useOperacaoFilter();

  return useQuery<ReceitaMensal[]>({
    queryKey: ["receita-mensal", filters.ano, filters.mes, empresaIds, filters.supervisor, filters.codVend, filters.uf, filters.marca, [...visiveis]],
    queryFn: async () => {
      const meses: { ano: number; mes: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        let m = (filters.mes || new Date().getMonth() + 1) - i;
        let y = filters.ano;
        while (m <= 0) { m += 12; y--; }
        meses.push({ ano: y, mes: m });
      }

      const anos = [...new Set(meses.map(m => m.ano))];
      let query = supabase
        .from("vw_dashboard_kpis" as any)
        .select("ano,mes,receita_total,operacao")
        .in("ano", anos);

      if (empresaIds.length > 0) query = query.in("id_empresa", empresaIds);
      if (filters.supervisor) query = query.eq("supervisor", filters.supervisor);
      if (filters.codVend) query = query.eq("cod_vend", filters.codVend);
      if (filters.uf) query = query.eq("uf", filters.uf);
      if (filters.marca) query = query.eq("marca", filters.marca);
      if (filters.tabela) query = query.eq("tabela", filters.tabela);

      const { data, error } = await query;
      if (error) throw error;

      const rows = ((data as any[]) || []).filter(r => visiveis.has(r.operacao));

      const monthMap = new Map<string, number>();
      for (const row of rows) {
        const key = `${row.ano}-${row.mes}`;
        const mult = multipliers.get(row.operacao) ?? 1;
        monthMap.set(key, (monthMap.get(key) || 0) + (Number(row.receita_total) || 0) * mult);
      }

      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return meses.map(({ ano, mes }) => ({
        ano, mes,
        receita_total: monthMap.get(`${ano}-${mes}`) || 0,
        label: `${monthNames[mes - 1]}/${String(ano).slice(2)}`,
      }));
    },
    enabled: loaded,
    staleTime: 5 * 60 * 1000,
  });
}
