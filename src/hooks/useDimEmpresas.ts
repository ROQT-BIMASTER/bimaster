import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DimEmpresa {
  id_empresa: number;
  nome_empresa: string;
}

/**
 * Retorna a lista de filiais (dim_empresa) usadas globalmente por Financeiro,
 * Vendas, Contas a Pagar/Receber e Pedidos.
 */
export function useDimEmpresas() {
  return useQuery({
    queryKey: ["dim-empresas"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<DimEmpresa[]> => {
      const { data, error } = await (supabase as any)
        .from("dim_empresa")
        .select("id_empresa, nome_empresa")
        .order("nome_empresa", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DimEmpresa[];
    },
  });
}
