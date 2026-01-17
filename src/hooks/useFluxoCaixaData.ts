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

// Função auxiliar para buscar dados paginados com retry e logs detalhados
async function fetchPaginatedData<T>(
  tableName: 'contas_receber' | 'contas_pagar',
  filterEmpresas: number[],
  filterStatus: string,
  statusExclude: string
): Promise<T[]> {
  const PAGE_SIZE = 2000; // Aumentado para 2000 para menos requisições
  const MAX_RECORDS = 150000;
  let allData: T[] = [];
  let offset = 0;
  let hasMore = true;
  let batchNumber = 0;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;
  
  console.log(`[${tableName}] Iniciando busca paginada...`);
  
  try {
    while (hasMore && allData.length < MAX_RECORDS) {
      batchNumber++;
      
      try {
        let query = supabase
          .from(tableName)
          .select('*');
        
        if (filterEmpresas.length > 0) {
          query = query.in('empresa_id', filterEmpresas);
        }
        
        // Filtrar apenas por status - não por data - para capturar todos os vencidos
        if (filterStatus !== "todos") {
          query = query.eq('status', filterStatus.toLowerCase());
        } else {
          query = query.neq('status', statusExclude);
        }
        
        query = query.order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
        
        console.log(`[${tableName}] Batch ${batchNumber}: offset=${offset}, pageSize=${PAGE_SIZE}`);
        
        const { data, error } = await query;
        
        if (error) {
          consecutiveErrors++;
          console.error(`[${tableName}] Erro no batch ${batchNumber}:`, error);
          
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            console.error(`[${tableName}] Máximo de erros consecutivos atingido. Retornando ${allData.length} registros.`);
            break;
          }
          
          // Retry com delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        consecutiveErrors = 0; // Reset on success
        
        if (data && data.length > 0) {
          allData = [...allData, ...data as unknown as T[]];
          offset += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
          console.log(`[${tableName}] Batch ${batchNumber} OK: +${data.length} registros (total: ${allData.length})`);
        } else {
          hasMore = false;
          console.log(`[${tableName}] Batch ${batchNumber}: Nenhum registro retornado, finalizando.`);
        }
        
      } catch (batchError) {
        consecutiveErrors++;
        console.error(`[${tableName}] Exceção no batch ${batchNumber}:`, batchError);
        
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`[${tableName}] Máximo de exceções consecutivas. Retornando ${allData.length} registros.`);
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (outerError) {
    console.error(`[${tableName}] Erro crítico na busca:`, outerError);
  }
  
  console.log(`[${tableName}] CONCLUÍDO: ${allData.length} registros em ${batchNumber} batches`);
  return allData;
}

export function useFluxoCaixaData(options: UseFluxoCaixaDataOptions) {
  const { filterAnos, filterMeses, filterEmpresas, filterStatus, filterVendedor, filterCliente } = options;
  
  // Keys for query caching
  const empresasKey = filterEmpresas.length > 0 ? filterEmpresas.sort().join(',') : 'all';
  
  const { startDate, endDate } = buildDateRange(filterAnos, filterMeses);
  
  // Fetch Contas a Receber - buscar TUDO sem filtro de data para aging completo
  const { data: contasReceberRaw, isLoading: loadingReceber, refetch: refetchReceber } = useQuery({
    queryKey: ["fluxo-caixa-receber-v5", empresasKey, filterStatus],
    queryFn: async () => {
      return fetchPaginatedData<ContaReceber>(
        'contas_receber',
        filterEmpresas,
        filterStatus,
        'recebido'
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
  
  // Fetch Contas a Pagar - buscar TUDO sem filtro de data para aging completo
  const { data: contasPagarRaw, isLoading: loadingPagar, refetch: refetchPagar } = useQuery({
    queryKey: ["fluxo-caixa-pagar-v5", empresasKey, filterStatus],
    queryFn: async () => {
      return fetchPaginatedData<ContaPagar>(
        'contas_pagar',
        filterEmpresas,
        filterStatus,
        'pago'
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
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
