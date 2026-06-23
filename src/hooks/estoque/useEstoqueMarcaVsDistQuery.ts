import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MarcaVsDistRow {
  chave_raiz: string | null;
  sku_master: string | null;
  produto_raiz_distribuidoras: string | null;
  saldo_marca_un_folhas: number | null;
  saldo_marca_caixas: number | null;
  saldo_dist_unidades: number | null;
  saldo_dist_caixas: number | null;
  gap_unidades: number | null;
  marca_sincronizado_em: string | null;
}

export type FaixaCobertura = 'sem_marca' | 'sem_dist' | 'critica' | 'media' | 'ok';

export interface MarcaVsDistFiltros {
  busca: string;
  faixas: FaixaCobertura[];
}

export const MARCA_VS_DIST_FILTROS_INICIAIS: MarcaVsDistFiltros = {
  busca: '',
  faixas: [],
};

interface UseOpts {
  filtros: MarcaVsDistFiltros;
  page: number;
  pageSize: number;
}

export function coberturaPctOf(r: Pick<MarcaVsDistRow, 'saldo_marca_un_folhas' | 'saldo_dist_unidades'>): number | null {
  const m = Number(r.saldo_marca_un_folhas ?? 0);
  const d = Number(r.saldo_dist_unidades ?? 0);
  if (m <= 0) return null; // sem estoque marca = cobertura infinita / não aplicável
  return (d / m) * 100;
}

export function faixaOf(r: MarcaVsDistRow): FaixaCobertura {
  const m = Number(r.saldo_marca_un_folhas ?? 0);
  const d = Number(r.saldo_dist_unidades ?? 0);
  if (m <= 0 && d <= 0) return 'sem_marca';
  if (m > 0 && d <= 0) return 'sem_dist';
  const pct = (d / Math.max(m, 1)) * 100;
  if (pct < 50) return 'critica';
  if (pct < 100) return 'media';
  return 'ok';
}

export function useEstoqueMarcaVsDistribuidorasQuery({ filtros, page, pageSize }: UseOpts) {
  return useQuery({
    queryKey: ['estoque-marca-vs-dist', filtros, page, pageSize],
    placeholderData: keepPreviousData,
    staleTime: 600_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from('vw_estoque_consolidado_marca_vs_distribuidoras')
        .select('*', { count: 'exact' });

      if (filtros.busca) {
        const b = filtros.busca.trim();
        q = q.or(
          `sku_master.ilike.%${b}%,chave_raiz.ilike.%${b}%,produto_raiz_distribuidoras.ilike.%${b}%`,
        );
      }
      q = q
        .order('gap_unidades', { ascending: true, nullsFirst: false })
        .order('chave_raiz', { ascending: true });

      const from = page * pageSize;
      q = q.range(from, from + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      let rows = (data ?? []) as MarcaVsDistRow[];
      if (filtros.faixas.length) {
        rows = rows.filter((r) => filtros.faixas.includes(faixaOf(r)));
      }
      return { rows, total: count ?? 0 };
    },
  });
}

export interface MarcaVsDistKpis {
  total_raizes: number;
  total_marca_un: number;
  total_dist_un: number;
  gap_negativo: number; // raízes em que distribuidoras < marca (descoberto)
  cobertura_pct_geral: number;
  ultima_sync: string | null;
}

export function useEstoqueMarcaVsDistKpis() {
  return useQuery({
    queryKey: ['estoque-marca-vs-dist-kpis'],
    staleTime: 600_000,
    queryFn: async (): Promise<MarcaVsDistKpis> => {
      const { data, error } = await (supabase as any)
        .from('vw_estoque_consolidado_marca_vs_distribuidoras')
        .select('saldo_marca_un_folhas,saldo_dist_unidades,gap_unidades,marca_sincronizado_em')
        .limit(50_000);
      if (error) throw error;
      const rows = (data ?? []) as MarcaVsDistRow[];
      let totalM = 0;
      let totalD = 0;
      let descoberto = 0;
      let ultima: string | null = null;
      for (const r of rows) {
        totalM += Number(r.saldo_marca_un_folhas ?? 0);
        totalD += Number(r.saldo_dist_unidades ?? 0);
        if (Number(r.gap_unidades ?? 0) < 0) descoberto += 1;
        if (r.marca_sincronizado_em && (!ultima || r.marca_sincronizado_em > ultima)) {
          ultima = r.marca_sincronizado_em;
        }
      }
      return {
        total_raizes: rows.length,
        total_marca_un: totalM,
        total_dist_un: totalD,
        gap_negativo: descoberto,
        cobertura_pct_geral: totalM > 0 ? (totalD / totalM) * 100 : 0,
        ultima_sync: ultima,
      };
    },
  });
}
