import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";
import type { DashboardFilters } from "./useDashboardKPIs";

interface ReceitaEmpresa {
  id_empresa: number;
  nome_empresa: string;
  receita_total: number;
  qtde_pedidos: number;
}

export function useReceitaEmpresa(filters: DashboardFilters) {
  const { empresaIds } = useEmpresaContext();

  return useQuery<ReceitaEmpresa[]>({
    queryKey: ["receita-empresa", filters, empresaIds],
    queryFn: async () => {
      let query = supabase
        .from("vw_receita_empresa" as any)
        .select("*")
        .eq("ano", filters.ano);

      if (filters.mes) query = query.eq("mes", filters.mes);
      if (empresaIds.length > 0) query = query.in("id_empresa", empresaIds);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data as any[]) || [];
      // Aggregate by empresa
      const map = new Map<number, ReceitaEmpresa>();
      for (const row of rows) {
        const id = row.id_empresa;
        if (!map.has(id)) {
          map.set(id, { id_empresa: id, nome_empresa: row.nome_empresa || `Empresa ${id}`, receita_total: 0, qtde_pedidos: 0 });
        }
        const entry = map.get(id)!;
        entry.receita_total += Number(row.receita_total) || 0;
        entry.qtde_pedidos += Number(row.qtde_pedidos) || 0;
      }

      return [...map.values()].sort((a, b) => b.receita_total - a.receita_total);
    },
    staleTime: 5 * 60 * 1000,
  });
}
