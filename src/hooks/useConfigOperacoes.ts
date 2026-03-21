import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ConfigOperacao {
  id: string;
  operacao: string;
  tipo: string;
  visivel: boolean;
}

export function useConfigOperacoes() {
  return useQuery<ConfigOperacao[]>({
    queryKey: ["config-operacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_operacoes")
        .select("*")
        .order("operacao");
      if (error) throw error;
      return (data || []) as ConfigOperacao[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Returns a filter function and multiplier map for applying operacao config
 * to view data that includes the `operacao` column.
 */
export function useOperacaoFilter() {
  const { data: configs } = useConfigOperacoes();

  const visiveis = new Set<string>();
  const multipliers = new Map<string, number>();

  if (configs) {
    for (const c of configs) {
      if (c.visivel) {
        visiveis.add(c.operacao);
        multipliers.set(c.operacao, c.tipo === "negativo" ? -1 : 1);
      }
    }
  }

  return { visiveis, multipliers, loaded: !!configs };
}
