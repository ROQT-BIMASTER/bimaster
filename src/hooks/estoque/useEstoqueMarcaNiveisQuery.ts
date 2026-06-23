import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EstoqueMarcaNivelRow {
  empresa_id: number | null;
  empresa_nome: string | null;
  master_id: string | null;
  sku_master: string | null;
  nome: string | null;
  ean: string | null;
  cod_produto: number | null;
  nivel: number | null;
  saldo_marca_caixas: number | null;
  saldo_marca_unidades: number | null;
  sincronizado_em: string | null;
  origem_explosao: string | null;
}

export interface EstoqueMarcaNiveisFiltros {
  busca: string;
  empresas: number[];
  niveis: number[];
  apenas_com_saldo: boolean;
}

export const MARCA_NIVEIS_FILTROS_INICIAIS: EstoqueMarcaNiveisFiltros = {
  busca: '',
  empresas: [],
  niveis: [],
  apenas_com_saldo: true,
};

interface UseOpts {
  filtros: EstoqueMarcaNiveisFiltros;
  page: number;
  pageSize: number;
}

export function useEstoqueMarcaNiveisQuery({ filtros, page, pageSize }: UseOpts) {
  return useQuery({
    queryKey: ['estoque-marca-niveis', filtros, page, pageSize],
    placeholderData: keepPreviousData,
    staleTime: 600_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from('vw_estoque_marca_niveis')
        .select('*', { count: 'exact' });

      if (filtros.busca) {
        const b = filtros.busca.trim();
        q = q.or(`nome.ilike.%${b}%,sku_master.ilike.%${b}%,ean.ilike.%${b}%`);
      }
      if (filtros.empresas.length) q = q.in('empresa_id', filtros.empresas);
      if (filtros.niveis.length) q = q.in('nivel', filtros.niveis);
      if (filtros.apenas_com_saldo) q = q.gt('saldo_marca_unidades', 0);

      q = q
        .order('empresa_id', { ascending: true, nullsFirst: false })
        .order('sku_master', { ascending: true, nullsFirst: false })
        .order('nivel', { ascending: true });

      const from = page * pageSize;
      q = q.range(from, from + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;
      return {
        rows: (data ?? []) as EstoqueMarcaNivelRow[],
        total: count ?? 0,
      };
    },
  });
}

export interface EstoqueMarcaNiveisKpis {
  total_linhas: number;
  total_caixas: number;
  total_unidades: number;
  marcas_distintas: number;
  empresas_distintas: number;
  ultima_sync: string | null;
}

export function useEstoqueMarcaNiveisKpis(filtros: EstoqueMarcaNiveisFiltros) {
  return useQuery({
    queryKey: ['estoque-marca-niveis-kpis', filtros],
    staleTime: 600_000,
    queryFn: async (): Promise<EstoqueMarcaNiveisKpis> => {
      // Sumariza todas as linhas (limite 50k de segurança) — view materializa < 11k linhas hoje.
      let q = (supabase as any)
        .from('vw_estoque_marca_niveis')
        .select('empresa_id,sku_master,nivel,saldo_marca_caixas,saldo_marca_unidades,sincronizado_em')
        .limit(50_000);
      if (filtros.busca) {
        const b = filtros.busca.trim();
        q = q.or(`nome.ilike.%${b}%,sku_master.ilike.%${b}%,ean.ilike.%${b}%`);
      }
      if (filtros.empresas.length) q = q.in('empresa_id', filtros.empresas);
      if (filtros.niveis.length) q = q.in('nivel', filtros.niveis);
      if (filtros.apenas_com_saldo) q = q.gt('saldo_marca_unidades', 0);

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as EstoqueMarcaNivelRow[];
      const marcas = new Set<string>();
      const empresas = new Set<number>();
      let totalCx = 0;
      let totalUn = 0;
      let ultima: string | null = null;
      for (const r of rows) {
        if (r.sku_master) marcas.add(r.sku_master);
        if (r.empresa_id != null) empresas.add(r.empresa_id);
        totalCx += Number(r.saldo_marca_caixas ?? 0);
        totalUn += Number(r.saldo_marca_unidades ?? 0);
        if (r.sincronizado_em && (!ultima || r.sincronizado_em > ultima)) ultima = r.sincronizado_em;
      }
      return {
        total_linhas: rows.length,
        total_caixas: totalCx,
        total_unidades: totalUn,
        marcas_distintas: marcas.size,
        empresas_distintas: empresas.size,
        ultima_sync: ultima,
      };
    },
  });
}

export function useEstoqueMarcaNiveisEmpresas() {
  return useQuery({
    queryKey: ['estoque-marca-niveis-empresas'],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('vw_estoque_marca_niveis')
        .select('empresa_id,empresa_nome')
        .limit(10_000);
      if (error) throw error;
      const map = new Map<number, string>();
      for (const r of (data ?? []) as Array<{ empresa_id: number; empresa_nome: string | null }>) {
        if (r.empresa_id != null && !map.has(r.empresa_id)) {
          map.set(r.empresa_id, r.empresa_nome ?? String(r.empresa_id));
        }
      }
      return Array.from(map.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });
}
