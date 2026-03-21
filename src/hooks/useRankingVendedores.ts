import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import { useOperacaoFilter } from "./useConfigOperacoes";
import type { DashboardFilters } from "./useDashboardKPIs";

export interface RankingVendedor {
  cod_vend: number;
  vendedor: string;
  supervisor?: string;
  receita_total: number;
  qtde_pedidos: number;
  clientes_ativos: number;
}

export function useRankingVendedores(filters: DashboardFilters) {
  const { empresaIds } = useEmpresaContext();
  const { visiveis, multipliers, loaded } = useOperacaoFilter();

  return useQuery<RankingVendedor[]>({
    queryKey: ["ranking-vendedores", filters, empresaIds, [...visiveis]],
    queryFn: async () => {
      let query = supabase.from("vw_ranking_vendedores" as any).select("*").eq("ano", filters.ano);
      if (filters.mes) query = query.eq("mes", filters.mes);
      if (empresaIds.length > 0) query = query.in("id_empresa", empresaIds);
      if (filters.supervisor) query = query.eq("supervisor", filters.supervisor);

      const { data, error } = await query;
      if (error) throw error;

      const rows = ((data as any[]) || []).filter(r => visiveis.has(r.operacao));
      const map = new Map<number, RankingVendedor>();
      for (const row of rows) {
        const key = row.cod_vend;
        if (!map.has(key)) map.set(key, { cod_vend: key, vendedor: row.vendedor || `Vendedor ${key}`, supervisor: row.supervisor, receita_total: 0, qtde_pedidos: 0, clientes_ativos: 0 });
        const entry = map.get(key)!;
        const mult = multipliers.get(row.operacao) ?? 1;
        entry.receita_total += (Number(row.receita_total) || 0) * mult;
        entry.qtde_pedidos += Number(row.qtde_pedidos) || 0;
        entry.clientes_ativos += Number(row.clientes_ativos) || 0;
      }
      return [...map.values()].sort((a, b) => b.receita_total - a.receita_total);
    },
    enabled: loaded,
    staleTime: 5 * 60 * 1000,
  });
}
