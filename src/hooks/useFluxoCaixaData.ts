import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface ContaReceber {
  id: string;
  empresa_id: number;
  empresa_nome: string;
  cliente_nome: string;
  cliente_codigo: string;
  vendedor_nome: string;
  valor_original: number;
  valor_aberto: number;
  data_vencimento: string;
  data_recebimento: string | null;
  status: string;
  numero_documento: string;
}

interface ContaPagar {
  id: string;
  empresa_id: number;
  empresa_nome: string;
  fornecedor_nome: string;
  fornecedor_codigo: string;
  valor_original: number;
  valor_aberto: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  numero_documento: string;
}

interface UseFluxoCaixaDataOptions {
  filterAnos: number[];
  filterMeses: number[];
  filterEmpresas: number[];
  filterStatus: string;
  filterVendedor: string;
  filterCliente: string;
}

// Build date range from years/months filters
const buildDateRange = (filterAnos: number[], filterMeses: number[]) => {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  
  // Default: 5 anos passados até 1 ano futuro para capturar todos os vencidos
  if (filterAnos.length === 0) {
    return {
      startDate: `${anoAtual - 5}-01-01`,
      endDate: `${anoAtual + 1}-12-31`
    };
  }
  
  const minAno = Math.min(...filterAnos);
  const maxAno = Math.max(...filterAnos);
  
  return {
    startDate: `${minAno}-01-01`,
    endDate: `${maxAno}-12-31`
  };
};

// Função auxiliar para buscar dados paginados com busca PARALELA
async function fetchPaginatedData<T>(
  tableName: 'contas_receber' | 'contas_pagar',
  filterEmpresas: number[],
  filterStatus: string,
  statusExclude: string
): Promise<T[]> {
  const PAGE_SIZE = 1000; // Supabase limita a 1000 registros por requisição
  const MAX_CONCURRENT = 8; // Aumentar concorrência para compensar batches menores
  
  console.log(`[${tableName}] Iniciando busca paralela...`);
  
  try {
    // PASSO 1: Obter contagem total primeiro
    let countQuery = supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (filterEmpresas.length > 0) {
      countQuery = countQuery.in('empresa_id', filterEmpresas);
    }
    
    if (filterStatus !== "todos") {
      countQuery = countQuery.eq('status', filterStatus.toLowerCase());
    } else {
      countQuery = countQuery.neq('status', statusExclude);
    }
    
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error(`[${tableName}] Erro ao obter contagem:`, countError);
      return [];
    }
    
    const totalCount = count || 0;
    console.log(`[${tableName}] Total de registros: ${totalCount}`);
    
    if (totalCount === 0) {
      return [];
    }
    
    // PASSO 2: Calcular batches necessários
    const totalBatches = Math.ceil(totalCount / PAGE_SIZE);
    console.log(`[${tableName}] Total de batches necessários: ${totalBatches}`);
    
    // PASSO 3: Criar função para buscar um batch
    const fetchBatch = async (batchIndex: number): Promise<T[]> => {
      const offset = batchIndex * PAGE_SIZE;
      
      let query = supabase
        .from(tableName)
        .select('*');
      
      if (filterEmpresas.length > 0) {
        query = query.in('empresa_id', filterEmpresas);
      }
      
      if (filterStatus !== "todos") {
        query = query.eq('status', filterStatus.toLowerCase());
      } else {
        query = query.neq('status', statusExclude);
      }
      
      query = query.order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
      
      const { data, error } = await query;
      
      if (error) {
        console.error(`[${tableName}] Erro no batch ${batchIndex + 1}:`, error);
        return [];
      }
      
      console.log(`[${tableName}] Batch ${batchIndex + 1}/${totalBatches}: ${data?.length || 0} registros`);
      return (data || []) as unknown as T[];
    };
    
    // PASSO 4: Buscar em paralelo com limite de concorrência
    const allData: T[] = [];
    
    for (let i = 0; i < totalBatches; i += MAX_CONCURRENT) {
      const batchPromises: Promise<T[]>[] = [];
      
      for (let j = 0; j < MAX_CONCURRENT && (i + j) < totalBatches; j++) {
        batchPromises.push(fetchBatch(i + j));
      }
      
      console.log(`[${tableName}] Executando batches ${i + 1} a ${Math.min(i + MAX_CONCURRENT, totalBatches)}...`);
      
      const results = await Promise.all(batchPromises);
      
      results.forEach(batch => {
        allData.push(...batch);
      });
      
      console.log(`[${tableName}] Progresso: ${allData.length}/${totalCount} registros`);
    }
    
    console.log(`[${tableName}] ✅ CONCLUÍDO: ${allData.length} registros carregados`);
    return allData;
    
  } catch (error) {
    console.error(`[${tableName}] Erro crítico:`, error);
    return [];
  }
}

export function useFluxoCaixaData(options: UseFluxoCaixaDataOptions) {
  const { filterAnos, filterMeses, filterEmpresas, filterStatus, filterVendedor, filterCliente } = options;
  
  // Keys for query caching
  const empresasKey = filterEmpresas.length > 0 ? filterEmpresas.sort().join(',') : 'all';
  
  const { startDate, endDate } = buildDateRange(filterAnos, filterMeses);
  
  // Fetch Contas a Receber - buscar TUDO sem filtro de data para aging completo
  const { data: contasReceberRaw, isLoading: loadingReceber, refetch: refetchReceber } = useQuery({
    queryKey: ["fluxo-caixa-receber-v6-parallel", empresasKey, filterStatus],
    queryFn: async () => {
      return fetchPaginatedData<ContaReceber>(
        'contas_receber',
        filterEmpresas,
        filterStatus,
        'recebido'
      );
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 15 * 60 * 1000, // 15 minutos
  });
  
  // Fetch Contas a Pagar - buscar TUDO sem filtro de data para aging completo
  const { data: contasPagarRaw, isLoading: loadingPagar, refetch: refetchPagar } = useQuery({
    queryKey: ["fluxo-caixa-pagar-v6-parallel", empresasKey, filterStatus],
    queryFn: async () => {
      return fetchPaginatedData<ContaPagar>(
        'contas_pagar',
        filterEmpresas,
        filterStatus,
        'pago'
      );
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 15 * 60 * 1000, // 15 minutos
  });
  
  // Filter data by vendedor/cliente and month on frontend
  const contasReceber = useMemo(() => {
    if (!contasReceberRaw) return [];
    let filtered = [...contasReceberRaw];
    
    // Month filter on frontend
    if (filterMeses.length > 0) {
      filtered = filtered.filter(c => {
        if (!c.data_vencimento) return false;
        const mes = new Date(c.data_vencimento).getMonth() + 1;
        return filterMeses.includes(mes);
      });
    }
    
    // Year filter on frontend - CORRIGIDO: aplica para 1+ anos selecionados
    if (filterAnos.length >= 1) {
      filtered = filtered.filter(c => {
        if (!c.data_vencimento) return false;
        const ano = new Date(c.data_vencimento).getFullYear();
        return filterAnos.includes(ano);
      });
    }
    
    if (filterVendedor !== "todos") {
      filtered = filtered.filter(c => c.vendedor_nome === filterVendedor);
    }
    
    if (filterCliente.trim()) {
      const search = filterCliente.toLowerCase();
      filtered = filtered.filter(c => 
        c.cliente_nome?.toLowerCase().includes(search) ||
        c.cliente_codigo?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [contasReceberRaw, filterMeses, filterAnos, filterVendedor, filterCliente]);
  
  const contasPagar = useMemo(() => {
    if (!contasPagarRaw) return [];
    let filtered = [...contasPagarRaw];
    
    // Month filter
    if (filterMeses.length > 0) {
      filtered = filtered.filter(c => {
        if (!c.data_vencimento) return false;
        const mes = new Date(c.data_vencimento).getMonth() + 1;
        return filterMeses.includes(mes);
      });
    }
    
    // Year filter - CORRIGIDO: aplica para 1+ anos selecionados
    if (filterAnos.length >= 1) {
      filtered = filtered.filter(c => {
        if (!c.data_vencimento) return false;
        const ano = new Date(c.data_vencimento).getFullYear();
        return filterAnos.includes(ano);
      });
    }
    
    if (filterCliente.trim()) {
      const search = filterCliente.toLowerCase();
      filtered = filtered.filter(c => 
        c.fornecedor_nome?.toLowerCase().includes(search) ||
        c.fornecedor_codigo?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [contasPagarRaw, filterMeses, filterAnos, filterCliente]);
  
  // Extract unique values
  const empresas = useMemo(() => {
    const all = [...(contasReceberRaw || []), ...(contasPagarRaw || [])];
    const seen = new Map<number, string>();
    all.forEach(c => {
      if (c.empresa_id && c.empresa_nome && !seen.has(c.empresa_id)) {
        seen.set(c.empresa_id, c.empresa_nome);
      }
    });
    return Array.from(seen.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [contasReceberRaw, contasPagarRaw]);
  
  const vendedores = useMemo(() => {
    const all = contasReceberRaw || [];
    const seen = new Set<string>();
    all.forEach(c => {
      if (c.vendedor_nome) seen.add(c.vendedor_nome);
    });
    return Array.from(seen).sort();
  }, [contasReceberRaw]);
  
  // Available years in data
  const anosDisponiveis = useMemo(() => {
    const all = [...(contasReceberRaw || []), ...(contasPagarRaw || [])];
    const anos = new Set<number>();
    all.forEach(c => {
      if (c.data_vencimento) {
        anos.add(new Date(c.data_vencimento).getFullYear());
      }
    });
    return Array.from(anos).sort((a, b) => b - a);
  }, [contasReceberRaw, contasPagarRaw]);
  
  const refetch = () => {
    refetchReceber();
    refetchPagar();
  };
  
  return {
    contasReceber,
    contasPagar,
    contasReceberRaw: contasReceberRaw || [],
    contasPagarRaw: contasPagarRaw || [],
    isLoading: loadingReceber || loadingPagar,
    refetch,
    empresas,
    vendedores,
    anosDisponiveis,
    dateRange: { startDate, endDate },
    totalRecordsReceber: contasReceberRaw?.length || 0,
    totalRecordsPagar: contasPagarRaw?.length || 0
  };
}
