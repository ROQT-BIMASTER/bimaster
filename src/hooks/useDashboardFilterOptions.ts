import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaContext } from "@/contexts/EmpresaContext";

export function useDashboardFilterOptions() {
  const { empresaIds } = useEmpresaContext();

  const supervisores = useQuery({
    queryKey: ["filter-supervisores", empresaIds],
    queryFn: async () => {
      let query = supabase.from("dim_vendedor").select("supervisor").not("supervisor", "is", null);
      const { data } = await query;
      const unique = [...new Set((data || []).map((d: any) => d.supervisor).filter(Boolean))].sort();
      return unique as string[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const vendedores = useQuery({
    queryKey: ["filter-vendedores", empresaIds],
    queryFn: async () => {
      const { data } = await supabase.from("dim_vendedor").select("cod_vend,nome_vendedor").order("nome_vendedor");
      return (data || []) as { cod_vend: number; nome_vendedor: string }[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const ufs = useQuery({
    queryKey: ["filter-ufs"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("uf").not("uf", "is", null);
      const unique = [...new Set((data || []).map((d: any) => d.uf).filter(Boolean))].sort();
      return unique as string[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const marcas = useQuery({
    queryKey: ["filter-marcas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendas_union")
        .select("marca")
        .not("marca", "is", null)
        .limit(1000);
      const unique = [...new Set((data || []).map((d: any) => d.marca).filter(Boolean))].sort();
      return unique as string[];
    },
    staleTime: 10 * 60 * 1000,
  });

  return { supervisores, vendedores, ufs, marcas };
}
