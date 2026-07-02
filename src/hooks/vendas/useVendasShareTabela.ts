import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ShareTabelaRow {
  tabela_preco_id: number | null;
  tabela_preco_nome: string;
  notas: number;
  faturamento: number;
  share_pct: number; // 0..100
}

const sb = supabase as any;

export function useVendasShareTabela(p: { de: string | null; ate: string | null; empresa?: number | null }) {
  return useQuery({
    queryKey: ["vendas_share_tabela_preco", p.de, p.ate, p.empresa ?? null],
    enabled: !!(p.de && p.ate),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ShareTabelaRow[]> => {
      const { data, error } = await sb.rpc("vendas_share_tabela_preco", {
        p_de: p.de,
        p_ate: p.ate,
        p_empresa: p.empresa ?? null,
      });
      if (error) throw error;
      const rows = ((data ?? []) as any[]).map((r) => ({
        tabela_preco_id: r.tabela_preco_id ?? null,
        tabela_preco_nome: (r.tabela_preco_nome ?? "(sem tabela)") as string,
        notas: Number(r.notas ?? 0),
        faturamento: Number(r.faturamento ?? 0),
        share_pct: 0,
      }));
      const total = rows.reduce((s, r) => s + r.faturamento, 0);
      rows.forEach((r) => { r.share_pct = total > 0 ? (r.faturamento / total) * 100 : 0; });
      rows.sort((a, b) => b.faturamento - a.faturamento);
      return rows;
    },
  });
}
