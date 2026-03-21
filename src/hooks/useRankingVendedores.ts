import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import type { DashboardFilters } from "./useDashboardKPIs";

interface RankingVendedor {
  cod_vend: number;
  vendedor: string;
  receita_total: number;
  qtde_pedidos: number;
  clientes_ativos: number;
}

export function useRankingVendedores(filters: DashboardFilters) {
  const { empresaIds } = useEmpresaContext();

  return useQuery<RankingVendedor[]>({
    queryKey: ["ranking-vendedores", filters, empresaIds],
    queryFn: async () => {
      let query = supabase
        .from("vw_ranking_vendedores" as any)
        .select("*")
        .eq("ano", filters.ano);

      if (filters.mes) query = query.eq("mes", filters.mes);
      if (empresaIds.length > 0) query = query.in("id_empresa", empresaIds);
      if (filters.supervisor) query = query.eq("supervisor", filters.supervisor);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data as any[]) || [];
      const map = new Map<number, RankingVendedor>();
      for (const row of rows) {
        const key = row.cod_vend;
        if (!map.has(key)) {
          map.set(key, { cod_vend: key, vendedor: row.vendedor || `Vendedor ${key}`, receita_total: 0, qtde_pedidos: 0, clientes_ativos: 0 });
        }
        const entry = map.get(key)!;
        entry.receita_total += Number(row.receita_total) || 0;
        entry.qtde_pedidos += Number(row.qtde_pedidos) || 0;
        entry.clientes_ativos += Number(row.clientes_ativos) || 0;
      }

      return [...map.values()].sort((a, b) => b.receita_total - a.receita_total).slice(0, 10);
    },
    staleTime: 5 * 60 * 1000,
  });
}
