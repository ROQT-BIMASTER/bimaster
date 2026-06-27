import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VendasFilters } from "@/hooks/useVendasAnalise";

export interface VendasPorTabelaRow {
  tabela_preco_id: number | null;
  tabela_preco_nome: string;
  faturamento: number;
  notas: number;
  qtd_un: number;
  pct: number;
}

const sb = supabase as any;
const STALE = 5 * 60 * 1000;

export function useVendasPorTabela(f: VendasFilters) {
  return useQuery({
    queryKey: ["vendas_por_tabela", f],
    queryFn: async (): Promise<VendasPorTabelaRow[]> => {
      const vendedorId = f.vendedor ? Number(f.vendedor) : null;
      const { data, error } = await sb.rpc("vendas_por_tabela", {
        p_de: f.de,
        p_ate: f.ate,
        p_empresa_id: f.empresa,
        p_vendedor_futura_id: Number.isFinite(vendedorId) ? vendedorId : null,
      });
      if (error) throw error;
      const rows = (data || []).map((r: any) => ({
        tabela_preco_id: r.tabela_preco_id ?? null,
        tabela_preco_nome: (r.tabela_preco_nome ?? "(sem tabela)") as string,
        faturamento: Number(r.faturamento ?? 0),
        notas: Number(r.notas ?? 0),
        qtd_un: Number(r.qtd_un ?? 0),
        pct: 0,
      }));
      const total = rows.reduce((s: number, r: VendasPorTabelaRow) => s + r.faturamento, 0);
      rows.forEach((r: VendasPorTabelaRow) => { r.pct = total > 0 ? (r.faturamento / total) * 100 : 0; });
      rows.sort((a: VendasPorTabelaRow, b: VendasPorTabelaRow) => b.faturamento - a.faturamento);
      return rows;
    },
    staleTime: STALE,
    enabled: !!(f.de && f.ate),
  });
}
