import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Dimensao } from "@/lib/vendas/analisePresets";
import type { Metrica } from "@/lib/charts/corporateTheme";

const sb = supabase as any;

export interface AnaliseParams {
  metrica: Metrica;
  dimensao: Dimensao;
  de: string | null;
  ate: string | null;
  empresa_id?: number | null;
  vendedor_futura_id?: number | null;
  tabela_id?: number | null;
  limit?: number;
}

export interface AnaliseRow {
  label: string;
  valor: number;
}

const TEMPORAIS: Dimensao[] = ["mes", "trimestre", "ano"];

export function useAnaliseRPC(p: AnaliseParams) {
  return useQuery({
    queryKey: ["vendas_analise", p],
    enabled: !!p.de && !!p.ate,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AnaliseRow[]> => {
      const { data, error } = await sb.rpc("vendas_analise", {
        p_metrica: p.metrica,
        p_dimensao: p.dimensao,
        p_de: p.de,
        p_ate: p.ate,
        p_empresa_id: p.empresa_id ?? null,
        p_vendedor_futura_id: p.vendedor_futura_id ?? null,
        p_tabela_id: p.tabela_id ?? null,
        p_limit: p.limit ?? 50,
      });
      if (error) throw error;
      const rows = ((data || []) as any[]).map((r) => ({
        label: String(r.label ?? ""),
        valor: Number(r.valor ?? 0),
      }));
      if (TEMPORAIS.includes(p.dimensao)) {
        rows.sort((a, b) => a.label.localeCompare(b.label));
      }
      return rows;
    },
  });
}
