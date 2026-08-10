import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface MunicipioVendedor {
  nome: string;
  clientes: number;
  ultima_compra: string | null;
  receita: number;
  mais_recente: boolean;
}

export interface MunicipioIntelligence {
  municipio_id: number;
  municipio_nome: string;
  uf_sigla: string;
  regiao_nome: string;
  microrregiao_id: number;
  microrregiao_nome: string;
  populacao: number;
  pib_mil_reais: number;
  pib_per_capita: number;
  total_clientes: number;
  clientes_com_compra: number;
  receita_total: number;
  receita_maior: number;
  ticket_medio: number;
  total_prospects: number;
  total_leads: number;
  densidade_comercial: number;
  intensidade_comercial: number;
  status_comercial: string;
  vendedor_nome: string | null;
  vendedores: MunicipioVendedor[];
  total_count: number;
}

export interface MunicipioOportunidade {
  municipio_id: number;
  municipio_nome: string;
  uf_sigla: string;
  regiao_nome: string;
  microrregiao_id: number;
  microrregiao_nome: string;
  populacao: number;
  pib_mil_reais: number;
  pib_per_capita: number;
}



export interface MunicipiosKPIs {
  total_municipios: number;
  municipios_atendidos: number;
  taxa_penetracao: number;
  receita_total_municipios: number;
  densidade_media: number;
  pib_total: number;
  populacao_total: number;
  municipios_prospect: number;
  municipios_lead: number;
  municipios_virgem: number;
}

export interface SupervisorShare {
  supervisor: string;
  total_clientes: number;
  total_municipios: number;
  total_vendedores: number;
}

export interface MunicipiosFilters {
  uf: string | null;
  regiao: string | null;
  microrregiao_id: number | null;
  status: string | null;
  vendedor: string | null;
  search: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  page: number;
}

const PAGE_SIZE = 50;

export function useMunicipiosIntelligence() {
  const [filters, setFilters] = useState<MunicipiosFilters>({
    uf: null,
    regiao: null,
    microrregiao_id: null,
    status: null,
    vendedor: null,
    search: '',
    sortColumn: 'nome',
    sortDirection: 'asc',
    page: 0,
  });

  const rpcParams = {
    p_uf: filters.uf || undefined,
    p_regiao: filters.regiao || undefined,
    p_microrregiao_id: filters.microrregiao_id || undefined,
    p_search: filters.search || undefined,
    p_status: filters.status || undefined,
  };

  const rpcParamsVend = { ...rpcParams, p_vendedor: filters.vendedor || undefined };


  // KPIs query
  const kpisQuery = useQuery({
    queryKey: ['municipios-kpis', filters.uf, filters.regiao, filters.microrregiao_id, filters.status, filters.search, filters.vendedor],
    queryFn: async (): Promise<MunicipiosKPIs> => {
      const { data, error } = await supabase.rpc('fn_get_municipios_kpis', rpcParamsVend as any);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        total_municipios: Number(row?.total_municipios || 0),
        municipios_atendidos: Number(row?.municipios_atendidos || 0),
        taxa_penetracao: Number(row?.taxa_penetracao || 0),
        receita_total_municipios: Number(row?.receita_total_municipios || 0),
        densidade_media: Number(row?.densidade_media || 0),
        pib_total: Number(row?.pib_total || 0),
        populacao_total: Number(row?.populacao_total || 0),
        municipios_prospect: Number(row?.municipios_prospect || 0),
        municipios_lead: Number(row?.municipios_lead || 0),
        municipios_virgem: Number(row?.municipios_virgem || 0),
      };
    },
    staleTime: 60 * 1000,
  });

  // Top 10 opportunities query (Virgem municipalities sorted by PIB desc)
  // Uses a dedicated lightweight RPC (no vendor/revenue aggregation) to avoid timeouts.
  // NOTE: the "vendedor" filter is intentionally NOT applied here — opportunities are
  // municipalities without any client, so no vendor can be attributed to them.
  const topOpportunitiesQuery = useQuery({
    queryKey: ['municipios-top-opportunities', filters.uf, filters.regiao, filters.microrregiao_id, filters.search],
    queryFn: async (): Promise<MunicipioOportunidade[]> => {
      const payload = {
        p_uf: filters.uf || undefined,
        p_regiao: filters.regiao || undefined,
        p_microrregiao_id: filters.microrregiao_id || undefined,
        p_search: filters.search || undefined,
        p_limit: 10,
      };
      logger.info('[municipios-oportunidades] RPC payload', payload);

      const { data, error } = await supabase.rpc('fn_get_municipios_oportunidades', payload as any);

      if (error) {
        logger.error('[municipios-oportunidades] RPC erro', {
          message: error.message,
          details: (error as any).details,
          hint: (error as any).hint,
          code: (error as any).code,
        });
      } else {
        logger.info('[municipios-oportunidades] RPC resposta', {
          rows: (data as any[])?.length ?? 0,
          primeiro: (data as any[])?.[0] ?? null,
        });
      }

      const mapa = (rows: any[]): MunicipioOportunidade[] => rows.map(r => ({
        municipio_id: Number(r.municipio_id),
        municipio_nome: r.municipio_nome,
        uf_sigla: r.uf_sigla,
        regiao_nome: r.regiao_nome,
        microrregiao_id: Number(r.microrregiao_id),
        microrregiao_nome: r.microrregiao_nome,
        populacao: Number(r.populacao || 0),
        pib_mil_reais: Number(r.pib_mil_reais || 0),
        pib_per_capita: Number(r.pib_per_capita || 0),
      }));

      const principais = !error ? mapa((data as any[]) || []) : [];
      if (principais.length > 0) return principais;

      // Fallback: consulta alternativa pela função completa, filtrando status "virgem"
      logger.warn('[municipios-oportunidades] usando consulta alternativa (fallback)', {
        motivo: error ? 'erro na RPC leve' : 'RPC leve retornou vazio',
      });

      const fallbackPayload = {
        p_uf: filters.uf || undefined,
        p_regiao: filters.regiao || undefined,
        p_microrregiao_id: filters.microrregiao_id || undefined,
        p_search: filters.search || undefined,
        p_status: 'virgem',
        p_sort_column: 'pib',
        p_sort_direction: 'desc',
        p_limit: 10,
        p_offset: 0,
      };
      logger.info('[municipios-oportunidades] fallback payload', fallbackPayload);

      const fb = await supabase.rpc('fn_get_municipios_intelligence', fallbackPayload as any);
      if (fb.error) {
        logger.error('[municipios-oportunidades] fallback erro', {
          message: fb.error.message,
          code: (fb.error as any).code,
        });
        // Se a RPC leve falhou e o fallback também, propaga o erro original
        throw error ?? fb.error;
      }

      const fallbackRows = mapa((fb.data as any[]) || []);
      logger.info('[municipios-oportunidades] fallback resposta', { rows: fallbackRows.length });
      return fallbackRows;
    },
    staleTime: 60 * 1000,
  });

  // Share por supervisor (mesmos filtros de município)
  const shareSupervisorQuery = useQuery({
    queryKey: ['municipios-share-supervisor', filters.uf, filters.regiao, filters.microrregiao_id, filters.status, filters.search],
    queryFn: async (): Promise<SupervisorShare[]> => {
      const { data, error } = await supabase.rpc('fn_get_share_supervisor', rpcParams as any);
      if (error) throw error;
      return ((data as any[]) || []).map(r => ({
        supervisor: r.supervisor,
        total_clientes: Number(r.total_clientes || 0),
        total_municipios: Number(r.total_municipios || 0),
        total_vendedores: Number(r.total_vendedores || 0),
      }));
    },
    staleTime: 60 * 1000,
  });



  // Data query (paginated)
  const dataQuery = useQuery({
    queryKey: ['municipios-intelligence', filters],
    queryFn: async (): Promise<{ data: MunicipioIntelligence[]; totalCount: number }> => {
      const { data, error } = await supabase.rpc('fn_get_municipios_intelligence', {
        ...rpcParamsVend,
        p_sort_column: filters.sortColumn,
        p_sort_direction: filters.sortDirection,
        p_limit: PAGE_SIZE,
        p_offset: filters.page * PAGE_SIZE,
      } as any);
      if (error) throw error;
      const rows = (data as any[]) || [];
      return {
        data: rows.map(r => ({
          ...r,
          populacao: Number(r.populacao),
          pib_mil_reais: Number(r.pib_mil_reais),
          pib_per_capita: Number(r.pib_per_capita),
          total_clientes: Number(r.total_clientes),
          clientes_com_compra: Number(r.clientes_com_compra),
          receita_total: Number(r.receita_total),
          receita_maior: Number(r.receita_maior),
          ticket_medio: Number(r.ticket_medio),
          total_prospects: Number(r.total_prospects),
          total_leads: Number(r.total_leads),
          densidade_comercial: Number(r.densidade_comercial),
          intensidade_comercial: Number(r.intensidade_comercial),
          vendedores: Array.isArray(r.vendedores) ? r.vendedores : [],
        total_count: Number(r.total_count),
        })),
        totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
      };
    },
    staleTime: 60 * 1000,
  });

  // Export query (all filtered data, no pagination)
  const fetchAllForExport = useCallback(async (): Promise<MunicipioIntelligence[]> => {
    const allData: MunicipioIntelligence[] = [];
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase.rpc('fn_get_municipios_intelligence', {
        ...rpcParamsVend,
        p_sort_column: filters.sortColumn,
        p_sort_direction: filters.sortDirection,
        p_limit: batchSize,
        p_offset: offset,
      } as any);
      if (error) throw error;
      const rows = (data as any[]) || [];
      allData.push(...rows.map(r => ({
        ...r,
        populacao: Number(r.populacao),
        pib_mil_reais: Number(r.pib_mil_reais),
        pib_per_capita: Number(r.pib_per_capita),
        total_clientes: Number(r.total_clientes),
        clientes_com_compra: Number(r.clientes_com_compra),
        receita_total: Number(r.receita_total),
        receita_maior: Number(r.receita_maior),
        ticket_medio: Number(r.ticket_medio),
        total_prospects: Number(r.total_prospects),
        total_leads: Number(r.total_leads),
        densidade_comercial: Number(r.densidade_comercial),
        intensidade_comercial: Number(r.intensidade_comercial),
        vendedores: Array.isArray(r.vendedores) ? r.vendedores : [],
        total_count: Number(r.total_count),
      })));
      hasMore = rows.length === batchSize;
      offset += batchSize;
    }
    return allData;
  }, [rpcParamsVend, filters.sortColumn, filters.sortDirection]);

  const updateFilter = useCallback((key: keyof MunicipiosFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      ...(key !== 'page' && key !== 'sortColumn' && key !== 'sortDirection' ? { page: 0 } : {}),
    }));
  }, []);

  const toggleSort = useCallback((column: string) => {
    setFilters(prev => ({
      ...prev,
      sortColumn: column,
      sortDirection: prev.sortColumn === column && prev.sortDirection === 'asc' ? 'desc' : 'asc',
      page: 0,
    }));
  }, []);

  const totalPages = Math.ceil((dataQuery.data?.totalCount || 0) / PAGE_SIZE);

  return {
    filters,
    updateFilter,
    toggleSort,
    kpis: kpisQuery.data,
    kpisLoading: kpisQuery.isLoading,
    municipios: dataQuery.data?.data || [],
    totalCount: dataQuery.data?.totalCount || 0,
    totalPages,
    dataLoading: dataQuery.isLoading,
    topOpportunities: topOpportunitiesQuery.data || [],
    topOpportunitiesLoading: topOpportunitiesQuery.isLoading,
    topOpportunitiesError: topOpportunitiesQuery.error as Error | null,
    refetchTopOpportunities: topOpportunitiesQuery.refetch,
    shareSupervisor: shareSupervisorQuery.data || [],
    shareSupervisorLoading: shareSupervisorQuery.isLoading,
    fetchAllForExport,
    pageSize: PAGE_SIZE,
  };
}
