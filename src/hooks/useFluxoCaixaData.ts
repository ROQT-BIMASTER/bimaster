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
  
  // Default: 3 anos passados até 1 ano futuro
  if (filterAnos.length === 0) {
    return {
      startDate: `${anoAtual - 3}-01-01`,
      endDate: `${anoAtual + 1}-12-31`
    };
  }
  
  const minAno = Math.min(...filterAnos);
  const maxAno = Math.max(...filterAnos);
  
  // Se meses específicos
  if (filterMeses.length > 0 && filterAnos.length === 1) {
    const minMes = Math.min(...filterMeses);
    const maxMes = Math.max(...filterMeses);
    return {
      startDate: `${minAno}-${String(minMes).padStart(2, '0')}-01`,
      endDate: `${maxAno}-${String(maxMes).padStart(2, '0')}-31`
    };
  }
  
  return {
    startDate: `${minAno}-01-01`,
    endDate: `${maxAno}-12-31`
  };
};

// Fetch all data in batches
const fetchAllInBatches = async <T>(
  tableName: string,
  startDate: string,
  endDate: string,
  filterEmpresas: number[],
  filterStatus: string
): Promise<T[]> => {
  const PAGE_SIZE = 1000;
  const MAX_RECORDS = 800000;
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;
  
  while (hasMore && allData.length < MAX_RECORDS) {
    let query = supabase
      .from(tableName as any)
      .select('*')
      .gte('data_vencimento', startDate)
      .lte('data_vencimento', endDate);
    
    if (filterEmpresas.length > 0) {
      query = query.in('empresa_id', filterEmpresas);
    }
    
    // Status filter
    const statusField = tableName === 'contas_receber' ? 'recebido' : 'pago';
    if (filterStatus !== "todos") {
      query = query.eq('status', filterStatus.toLowerCase());
    } else {
      query = query.neq('status', statusField);
    }
    
    query = query.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
    
    const { data, error } = await query;
    if (error) throw error;
    
    if (data && data.length > 0) {
      allData = [...allData, ...data as unknown as T[]];
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  
  return allData;
};

export function useFluxoCaixaData(options: UseFluxoCaixaDataOptions) {
  const { filterAnos, filterMeses, filterEmpresas, filterStatus, filterVendedor, filterCliente } = options;
  
  // Keys for query caching
  const anosKey = filterAnos.length > 0 ? filterAnos.sort().join(',') : 'all';
  const mesesKey = filterMeses.length > 0 ? filterMeses.sort().join(',') : 'all';
  const empresasKey = filterEmpresas.length > 0 ? filterEmpresas.sort().join(',') : 'all';
  
  const { startDate, endDate } = buildDateRange(filterAnos, filterMeses);
  
  // Fetch Contas a Receber
  const { data: contasReceberRaw, isLoading: loadingReceber, refetch: refetchReceber } = useQuery({
    queryKey: ["fluxo-caixa-receber-v2", anosKey, mesesKey, empresasKey, filterStatus],
    queryFn: () => fetchAllInBatches<ContaReceber>(
      'contas_receber',
      startDate,
      endDate,
      filterEmpresas,
      filterStatus
    )
  });
  
  // Fetch Contas a Pagar
  const { data: contasPagarRaw, isLoading: loadingPagar, refetch: refetchPagar } = useQuery({
    queryKey: ["fluxo-caixa-pagar-v2", anosKey, mesesKey, empresasKey, filterStatus],
    queryFn: () => fetchAllInBatches<ContaPagar>(
      'contas_pagar',
      startDate,
      endDate,
      filterEmpresas,
      filterStatus
    )
  });
  
  // Filter data by vendedor/cliente on frontend (more flexible)
  const contasReceber = useMemo(() => {
    if (!contasReceberRaw) return [];
    let filtered = contasReceberRaw;
    
    // Month filter on frontend
    if (filterMeses.length > 0) {
      filtered = filtered.filter(c => {
        if (!c.data_vencimento) return false;
        const mes = new Date(c.data_vencimento).getMonth() + 1;
        return filterMeses.includes(mes);
      });
    }
    
    // Year filter on frontend (for multiple years not in range)
    if (filterAnos.length > 1) {
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
    let filtered = contasPagarRaw;
    
    // Month filter
    if (filterMeses.length > 0) {
      filtered = filtered.filter(c => {
        if (!c.data_vencimento) return false;
        const mes = new Date(c.data_vencimento).getMonth() + 1;
        return filterMeses.includes(mes);
      });
    }
    
    // Year filter
    if (filterAnos.length > 1) {
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
    contasReceberRaw,
    contasPagarRaw,
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
