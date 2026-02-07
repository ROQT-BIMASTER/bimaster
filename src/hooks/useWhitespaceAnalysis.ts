import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { REGIOES_UFS } from "@/lib/constants/regioes";

export interface WhitespaceFilters {
  uf: string | null;
  regiao: string | null;
  minPenetracao: number;
}

export interface WhitespaceSortConfig {
  column: string;
  direction: "asc" | "desc";
}

export interface WhitespaceRow {
  municipio_id: number;
  municipio_nome: string;
  uf: string;
  regiao: string;
  populacao: number;
  pib_mil_reais: number;
  pib_per_capita: number;
  microrregiao_id: number;
  microrregiao_nome: string;
  total_municipios_micro: number;
  municipios_ativos_micro: number;
  penetracao_micro: number;
  clientes_vizinhos: number;
  receita_micro: number;
  vendedor_nome: string | null;
  score_expansao: number;
  total_count: number;
}

export interface WhitespaceKPIs {
  total_municipios_whitespace: number;
  pib_total_inexplorado: number;
  populacao_total_inexplorada: number;
  microrregioes_com_oportunidade: number;
  score_medio_expansao: number;
}

export interface WhitespaceMicroRow {
  microrregiao_id: number;
  microrregiao_nome: string;
  uf: string;
  total_municipios: number;
  municipios_ativos: number;
  municipios_whitespace: number;
  penetracao: number;
  pib_inexplorado: number;
  receita_atual: number;
  score_agregado: number;
}

const PAGE_SIZE = 50;

export function useWhitespaceAnalysis() {
  const [filters, setFilters] = useState<WhitespaceFilters>({
    uf: null,
    regiao: null,
    minPenetracao: 0,
  });
  const [sort, setSort] = useState<WhitespaceSortConfig>({
    column: "score_expansao",
    direction: "desc",
  });
  const [page, setPage] = useState(0);

  const kpisQuery = useQuery({
    queryKey: ["whitespace-kpis", filters],
    queryFn: async (): Promise<WhitespaceKPIs> => {
      const { data, error } = await supabase.rpc("fn_get_whitespace_kpis", {
        p_uf: filters.uf,
        p_regiao: filters.regiao,
        p_min_penetracao: filters.minPenetracao,
      });
      if (error) throw error;
      const row = (data as any)?.[0] || data;
      return {
        total_municipios_whitespace: Number(row.total_municipios_whitespace) || 0,
        pib_total_inexplorado: Number(row.pib_total_inexplorado) || 0,
        populacao_total_inexplorada: Number(row.populacao_total_inexplorada) || 0,
        microrregioes_com_oportunidade: Number(row.microrregioes_com_oportunidade) || 0,
        score_medio_expansao: Number(row.score_medio_expansao) || 0,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  const tableQuery = useQuery({
    queryKey: ["whitespace-table", filters, sort, page],
    queryFn: async (): Promise<{ rows: WhitespaceRow[]; totalCount: number }> => {
      const { data, error } = await supabase.rpc("fn_get_whitespace_analysis", {
        p_uf: filters.uf,
        p_regiao: filters.regiao,
        p_min_penetracao: filters.minPenetracao,
        p_sort_column: sort.column,
        p_sort_direction: sort.direction,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data as any[]) || [];
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
      return { rows, totalCount };
    },
    staleTime: 5 * 60 * 1000,
  });

  const chartQuery = useQuery({
    queryKey: ["whitespace-chart", filters],
    queryFn: async (): Promise<WhitespaceMicroRow[]> => {
      const { data, error } = await supabase.rpc("fn_get_whitespace_top_microrregioes", {
        p_uf: filters.uf,
        p_regiao: filters.regiao,
        p_min_penetracao: filters.minPenetracao,
        p_limit: 15,
      });
      if (error) throw error;
      return (data as any[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateFilters = useCallback((newFilters: Partial<WhitespaceFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(0);
  }, []);

  const updateSort = useCallback((column: string) => {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "desc" ? "asc" : "desc",
    }));
    setPage(0);
  }, []);

  const ufsForRegiao = filters.regiao ? REGIOES_UFS[filters.regiao] || [] : [];

  const totalPages = Math.ceil((tableQuery.data?.totalCount || 0) / PAGE_SIZE);

  return {
    filters,
    sort,
    page,
    totalPages,
    pageSize: PAGE_SIZE,
    ufsForRegiao,
    kpis: kpisQuery.data,
    kpisLoading: kpisQuery.isLoading,
    tableData: tableQuery.data?.rows || [],
    tableTotal: tableQuery.data?.totalCount || 0,
    tableLoading: tableQuery.isLoading,
    chartData: chartQuery.data || [],
    chartLoading: chartQuery.isLoading,
    updateFilters,
    updateSort,
    setPage,
  };
}
