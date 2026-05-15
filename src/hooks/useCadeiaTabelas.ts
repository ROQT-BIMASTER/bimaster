import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TabelaCadeiaItem {
  id: string;
  codigo: string;
  nome: string;
  status: string;
  tabela_base_id: string | null;
  tipo_base: string;
  tipo_markup: "percentual" | "multiplicador" | "valor_fixo";
  valor_markup: number;
  ordem: number;
  nivel: number;
}

/**
 * Resolve a cadeia descendente (jusante) de tabelas a partir de uma raiz.
 * Inclui a raiz no nível 0.
 */
export function useCadeiaTabelas(tabelaRaizId: string | undefined) {
  return useQuery({
    queryKey: ["cadeia-tabelas-jusante", tabelaRaizId],
    enabled: !!tabelaRaizId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "fn_cadeia_tabelas_jusante" as any,
        { p_root: tabelaRaizId },
      );
      if (error) throw error;
      return (data || []) as TabelaCadeiaItem[];
    },
  });
}
