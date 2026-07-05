import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { callApi } from "@/lib/utils/api-helpers";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { logger } from "@/lib/logger";
import { 
  Download, Receipt, AlertCircle, CheckCircle, Clock, TrendingUp, Plus, FileText, Eye, EyeOff, BookOpen, 
  ArrowLeft, Brain, Bot, Pencil, User, Lock, ArrowUpDown, ArrowUp, ArrowDown, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, Tags, Building2, LayoutDashboard, CalendarDays, ChevronsUpDown, RefreshCw, CreditCard, MessageSquare, SlidersHorizontal, BarChart3, Search, X, Filter
} from "lucide-react";
import { DashboardContasPagar } from "@/components/financeiro/DashboardContasPagar";
import { ContasPagarHeaderKpis } from "@/components/financeiro/ContasPagarHeaderKpis";
import { CalendarioVencimentos } from "@/components/financeiro/CalendarioVencimentos";
import { SofiaFloatingChat } from "@/components/financeiro/SofiaFloatingChat";
import { PaymentChatConsolidado } from "@/components/financeiro/payments/PaymentChatConsolidado";
import { ContasPagarDREView } from "@/components/financeiro/ContasPagarDREView";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { toast } from "sonner";
import { SolicitarOrcamentoDialog } from "@/components/trade/SolicitarOrcamentoDialog";
import { AprovarOrcamentoDialog } from "@/components/trade/AprovarOrcamentoDialog";
import { ClassificarContasPagarDialog } from "@/components/configuracoes/ClassificarContasPagarDialog";
import { EditarClassificacaoRapidaDialog } from "@/components/financeiro/EditarClassificacaoRapidaDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { calculateFinancialStatus } from "@/hooks/useFinancialStatus";
import { formatLocalDate } from "@/utils/dateUtils";
import { TourButton, contasPagarTourSteps, CONTAS_PAGAR_TOUR_ID } from "@/components/tour";
import { useEmpresaFilter } from "@/hooks/useEmpresaFilter";
import { useUIPermissions } from "@/hooks/useUIPermissions";
import { ContasPagarTabContent } from "@/components/financeiro/ContasPagarTabContent";
import type { ContaPagar } from "@/types/financeiro/contas-pagar";
import { uniqueChannelName } from "@/lib/realtime/channelName";

type SortColumnIA = 'fornecedor_nome' | 'numero_documento' | 'data_vencimento' | 'valor_original' | 'departamento_nome' | 'plano_contas_nome';
type SortDirection = 'asc' | 'desc';

export default function ContasAPagar() {
  const queryClient = useQueryClient();
  const { userType, isAdmin } = useUserRole();
  const { empresaIds: contextEmpresaIds, loading: loadingEmpresas } = useEmpresaFilter();
  // ADV-7: UI permission for payment approval
  const { canEdit: canApprovePayment } = useUIPermissions("financeiro_contas_pagar");
  
  // Filtros
  const [searchFornecedor, setSearchFornecedor] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmpresas, setFilterEmpresas] = useState<number[]>([]);

  // Inicializar filterEmpresas com as empresas do contexto
  const empresaInitRef = useRef(false);
  useEffect(() => {
    if (!loadingEmpresas && contextEmpresaIds.length > 0 && !empresaInitRef.current) {
      empresaInitRef.current = true;
      setFilterEmpresas(contextEmpresaIds);
    }
  }, [loadingEmpresas, contextEmpresaIds]);
  const [filterAno, setFilterAno] = useState<string>(new Date().getFullYear().toString());
  const [filterMes, setFilterMes] = useState<string>("all");
  const [filterDepartamento, setFilterDepartamento] = useState<string>("all");
  const [filterConta, setFilterConta] = useState<string>("all");
  const [filterPortadores, setFilterPortadores] = useState<string[]>([]);
  const [filterDiaVencimento, setFilterDiaVencimento] = useState<string>("");
  const [filterDiaPagamento, setFilterDiaPagamento] = useState<string>("");
  const [filterNatureza, setFilterNatureza] = useState<"all" | "provisionado" | "lancado">("all");
  const [filterCentroCusto, setFilterCentroCusto] = useState<string>("all");
  const [filterPlanoContas, setFilterPlanoContas] = useState<string>("all");

  // Aba ativa — usada para só buscar o dataset pesado quando a aba Classificação IA abre
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);

  // Dialogs
  const [solicitarOrcamentoOpen, setSolicitarOrcamentoOpen] = useState(false);
  const [aprovarOrcamentoOpen, setAprovarOrcamentoOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<any>(null);
  const [budgetFilter, setBudgetFilter] = useState<string>("all");
  const [classificarIAOpen, setClassificarIAOpen] = useState(false);
  const [reclassificarTudoOpen, setReclassificarTudoOpen] = useState(false);
  const [editarClassificacaoOpen, setEditarClassificacaoOpen] = useState(false);
  const [selectedContaClassificacao, setSelectedContaClassificacao] = useState<ContaPagar | null>(null);
  
  // Ação em lote - departamento
  const [batchDepartamento, setBatchDepartamento] = useState<string>("");
  
  // Paginação e Ordenação da aba Classificação IA
  const [currentPageIA, setCurrentPageIA] = useState(1);
  const [pageSizeIA, setPageSizeIA] = useState(25);
  const [sortColumnIA, setSortColumnIA] = useState<SortColumnIA>('data_vencimento');
  const [sortDirectionIA, setSortDirectionIA] = useState<SortDirection>('desc');
  const [selectedIdsIA, setSelectedIdsIA] = useState<Set<string>>(new Set());
  const [batchDepartamentoIA, setBatchDepartamentoIA] = useState<string>("");
  const [batchPlanoContasIA, setBatchPlanoContasIA] = useState<string>("");
  const [filtroFornecedorIA, setFiltroFornecedorIA] = useState<string>("");
  const [filtroDepartamentoIA, setFiltroDepartamentoIA] = useState<string>("");

  // Toggle UI (persistido em localStorage) — permite ocultar KPIs e Filtros para ganhar espaço
  const [showKpis, setShowKpis] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('cp:ui:showKpis') !== '0';
  });
  const [showFilters, setShowFilters] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('cp:ui:showFilters') !== '0';
  });
  useEffect(() => {
    try { window.localStorage.setItem('cp:ui:showKpis', showKpis ? '1' : '0'); } catch {}
  }, [showKpis]);
  useEffect(() => {
    try { window.localStorage.setItem('cp:ui:showFilters', showFilters ? '1' : '0'); } catch {}
  }, [showFilters]);


  // Realtime: auto-refresh quando contas_pagar mudar (ex: sync via n8n)
  useEffect(() => {
    const channel = supabase
      .channel(uniqueChannelName('contas-pagar-realtime'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contas_pagar' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['contas-pagar-headline'] });
          queryClient.invalidateQueries({ queryKey: ['contas-pagar-kpis-avancados'] });
          queryClient.invalidateQueries({ queryKey: ['contas-pagar-pagas-mes'] });
          queryClient.invalidateQueries({ queryKey: ['contas-pagar-ia'] });
          queryClient.invalidateQueries({ queryKey: ['cp-calendario-mes'] });
          queryClient.invalidateQueries({ queryKey: ['cp-tab-contas'] });
          queryClient.invalidateQueries({ queryKey: ['contas-pagar-dre-view'] });
          queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
          queryClient.invalidateQueries({ queryKey: ['lancamentos-dre'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Query departamentos
  const { data: departamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departamentos')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Query planos de contas
  const { data: planosContas } = useQuery({
    queryKey: ['planos-contas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_chart_of_accounts')
        .select('*')
        .eq('is_active', true)
        .eq('permite_lancamento', true)
        .order('code');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Converte filterEmpresas para string para o queryKey detectar mudanças corretamente
  const filterEmpresasKey = filterEmpresas.length > 0 ? filterEmpresas.sort().join(',') : 'all';
  const filterPortadoresKey = filterPortadores.length > 0 ? [...filterPortadores].sort().join(',') : 'all';

  // Helper: deriva intervalo de datas para o endpoint /query (server-side)
  const getDateRange = (includeMes: boolean) => {
    if (filterDiaVencimento) {
      return { vencimento_de: filterDiaVencimento, vencimento_ate: filterDiaVencimento };
    }
    if (includeMes && filterMes !== 'all' && filterAno !== 'all') {
      const mes = filterMes.padStart(2, '0');
      const lastDay = new Date(parseInt(filterAno), parseInt(filterMes), 0).getDate();
      return { vencimento_de: `${filterAno}-${mes}-01`, vencimento_ate: `${filterAno}-${mes}-${lastDay}` };
    }
    if (filterAno !== 'all') {
      return { vencimento_de: `${filterAno}-01-01`, vencimento_ate: `${filterAno}-12-31` };
    }
    const anoAtual = new Date().getFullYear();
    return { vencimento_de: `${anoAtual - 3}-01-01`, vencimento_ate: `${anoAtual + 1}-12-31` };
  };

  // Helper: pagina via API /query usando offset incremental (v4.4.3).
  // Cursor por UUID era inconsistente com order_by=data_vencimento e abortava o loop
  // na 1ª página. Offset puro é estável e suficiente para o volume atual (~6.5k/ano).
  const fetchAllViaApi = async (extraParams: Record<string, any>): Promise<ContaPagar[]> => {
    const PAGE = 1000;
    const all: ContaPagar[] = [];
    let offset = 0;
    let safety = 0;
    while (safety < 200) {
      safety++;
      const res = await callApi("contas-pagar-api", {
        path: "/query",
        limit: PAGE,
        offset,
        ...extraParams,
      });
      const batch = (res?.data || []) as ContaPagar[];
      all.push(...batch);
      const hasMore = res?.pagination?.has_more;
      if (!hasMore || batch.length < PAGE) break;
      offset += PAGE;
    }
    if (safety >= 200) {
      logger.warn('[ContasAPagar] fetchAllViaApi atingiu o limite de segurança (200 páginas).');
    }
    logger.debug('[ContasAPagar] fetchAllViaApi total carregado:', all.length);
    return all;
  };

  // Parâmetros comuns das RPCs agregadas (mesmos filtros globais em tudo → números coerentes)
  const rpcParams = () => {
    const range = getDateRange(true);
    return {
      p_empresa_ids: filterEmpresas.length > 0 ? filterEmpresas : null,
      p_data_de: range.vencimento_de || null,
      p_data_ate: range.vencimento_ate || null,
      p_departamento: filterDepartamento !== 'all' ? filterDepartamento : null,
      p_portadores: filterPortadores.length > 0 ? filterPortadores : null,
    };
  };

  // Chama uma RPC agregada; quando centro/plano estão filtrados, tenta a assinatura estendida (v2)
  // e cai para a base se a migration ainda não tiver sido aplicada (números ignoram centro/plano até lá).
  const callAggRpc = async (fn: 'fn_cp_dashboard' | 'fn_cp_kpis_avancados') => {
    const base = rpcParams();
    const temCentroPlano = filterCentroCusto !== 'all' || filterPlanoContas !== 'all';
    if (temCentroPlano) {
      const { data, error } = await supabase.rpc(fn, {
        ...base,
        p_centro_custo_id: filterCentroCusto !== 'all' ? filterCentroCusto : null,
        p_plano_contas_id: filterPlanoContas !== 'all' ? filterPlanoContas : null,
      } as any);
      if (!error) return data as any;
      logger.warn(`[ContasAPagar] ${fn} v2 indisponível (aplicar prompt RPC v2); usando assinatura base.`, error.message);
    }
    const { data, error } = await supabase.rpc(fn, base as any);
    if (error) throw error;
    return data as any;
  };

  // Agregados OFICIAIS (banco) — fn_cp_dashboard: exatos, independem de paginação.
  const { data: cpHeadline, isLoading: isLoadingHeadline } = useQuery({
    queryKey: ['contas-pagar-headline', filterEmpresasKey, filterAno, filterMes, filterDepartamento, filterPortadoresKey, filterDiaVencimento, filterCentroCusto, filterPlanoContas],
    queryFn: () => callAggRpc('fn_cp_dashboard'),
    staleTime: 60_000,
  });

  // KPIs avançados (PMP/pontualidade aproximados até a Fase 2b + concentrações + comparativo mensal)
  const { data: cpKpis, isLoading: isLoadingKpisAv } = useQuery({
    queryKey: ['contas-pagar-kpis-avancados', filterEmpresasKey, filterAno, filterMes, filterDepartamento, filterPortadoresKey, filterDiaVencimento, filterCentroCusto, filterPlanoContas],
    queryFn: () => callAggRpc('fn_cp_kpis_avancados'),
    staleTime: 60_000,
  });

  // "Pagas no Mês", assim como todos os KPIs do header, sai direto de cpHeadline.pago_mes_atual (fn_cp_dashboard v2).



  // Dataset completo — usado APENAS pela aba Classificação IA (lista/classifica títulos individualmente).
  // Gateado pela aba ativa: não pesa o carregamento inicial da página.
  const { data: contasDashboard, isLoading: isLoadingIA } = useQuery({
    queryKey: ['contas-pagar-ia', filterEmpresasKey, filterAno, filterMes, filterDepartamento, filterConta, filterPortadoresKey, filterDiaVencimento, filterDiaPagamento],
    enabled: activeTab === 'classificacao',
    queryFn: async () => {
      const range = getDateRange(true);
      // Filtros agora suportados server-side pelo /query (Fase A): sem pós-filtro client além do dia de pagamento
      const params: Record<string, any> = { ...range };
      if (filterEmpresas.length > 0) params.empresa_ids = filterEmpresas.join(',');
      if (filterDepartamento !== 'all') params.departamento_id = filterDepartamento;
      if (filterPortadores.length > 0) params.portadores = filterPortadores.join(',');
      const all = await fetchAllViaApi(params);
      return filterDiaPagamento ? all.filter(r => r.data_pagamento === filterDiaPagamento) : all;
    }
  });

  // Dados para compatibilidade (aba Classificação IA)
  const contasBase = contasDashboard;

  // Query separada para lista de portadores únicos - SEM filtro de portador para evitar ciclo
  const { data: portadoresUnicos = [], isLoading: isLoadingPortadores } = useQuery({
    queryKey: ['portadores-unicos', filterEmpresasKey, filterAno, filterMes, filterDepartamento, filterDiaVencimento, filterDiaPagamento],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const set = new Set<string>();
      let from = 0;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('contas_pagar')
          .select('portador');
        
        // Aplica os mesmos filtros EXCETO portador
        if (filterEmpresas.length > 0) {
          query = query.in('empresa_id', filterEmpresas);
        }
        if (filterDepartamento !== 'all') {
          query = query.eq('departamento_id', filterDepartamento);
        }
        if (filterDiaVencimento) {
          query = query.eq('data_vencimento', filterDiaVencimento);
        }
        if (filterDiaPagamento) {
          query = query.eq('data_pagamento', filterDiaPagamento);
        }
        
        // Ano/Mês - Só aplicar se NÃO houver filtro de dia específico
        if (!filterDiaVencimento && !filterDiaPagamento) {
          if (filterMes !== 'all' && filterAno !== 'all') {
            const mes = filterMes.padStart(2, '0');
            const lastDay = new Date(parseInt(filterAno), parseInt(filterMes), 0).getDate();
            query = query.gte('data_vencimento', `${filterAno}-${mes}-01`).lte('data_vencimento', `${filterAno}-${mes}-${lastDay}`);
          } else if (filterAno !== 'all') {
            query = query.gte('data_vencimento', `${filterAno}-01-01`).lte('data_vencimento', `${filterAno}-12-31`);
          } else {
            const hoje = new Date();
            const anoAtual = hoje.getFullYear();
            query = query.gte('data_vencimento', `${anoAtual - 3}-01-01`).lte('data_vencimento', `${anoAtual + 1}-12-31`);
          }
        }
        
        query = query.range(from, from + PAGE_SIZE - 1);
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
          data.forEach(c => { if (c.portador) set.add(c.portador); });
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      
      return Array.from(set).sort();
    }
  });

  // Aplica filtros da aba (Status + Busca) também nos dados usados por Dashboard/Calendário/KPIs.
  // Fazemos isso em memória para não refazer uma query gigante a cada tecla.
  const contas = useMemo(() => {
    let list = contasBase || [];

    if (filterStatus !== 'all') {
      const target = filterStatus.toLowerCase();
      list = list.filter(c =>
        calculateFinancialStatus(c.data_vencimento, c.data_pagamento, c.status, c.valor_aberto, c.valor_pago) === target
      );
    }

    const search = searchFornecedor.trim().toLowerCase();
    if (search) {
      list = list.filter(c => (c.fornecedor_nome || '').toLowerCase().includes(search));
    }

    return list;
  }, [contasBase, filterStatus, searchFornecedor]);

  const isLoading = isLoadingIA;

  // KPIs consolidados vivem em ContasPagarHeaderKpis (lê cpHeadline/cpKpis direto).

  // Empresas para o filtro — cadastro oficial (não depende mais de dataset carregado)
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-filtro-cp'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return (data || []) as { id: number; nome: string }[];
    },
    staleTime: 10 * 60_000,
  });

  // Centros de custo para o filtro
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros-custo-filtro-cp'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('centros_custo')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
    staleTime: 10 * 60_000,
  });

  // Query orçamentos
  const { data: budgets, isLoading: isLoadingBudgets, refetch: refetchBudgets } = useQuery({
    queryKey: ['trade-budgets', budgetFilter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      let query = supabase
        .from('trade_budgets')
        .select(`
          *,
          profiles!trade_budgets_requested_by_fkey(nome, email)
        `)
        .order('created_at', { ascending: false });

      if (budgetFilter !== "all") {
        query = query.eq('approval_status', budgetFilter);
      }

      if (userType !== 'admin') {
        query = query.eq('requested_by', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!userType,
  });

  const pendingBudgetsCount = budgets?.filter(b => b.approval_status === 'pending').length || 0;

  // Função para invalidar todas as queries de contas a pagar
  const invalidateContasQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['contas-pagar-headline'] });
    queryClient.invalidateQueries({ queryKey: ['contas-pagar-kpis-avancados'] });
    queryClient.invalidateQueries({ queryKey: ['contas-pagar-pagas-mes'] });
    queryClient.invalidateQueries({ queryKey: ['contas-pagar-ia'] });
    queryClient.invalidateQueries({ queryKey: ['cp-calendario-mes'] });
    queryClient.invalidateQueries({ queryKey: ['cp-tab-contas'] });
  }, [queryClient]);

  // Funções de ordenação IA tab
  const handleSortIA = (column: SortColumnIA) => {
    if (sortColumnIA === column) {
      setSortDirectionIA(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumnIA(column);
      setSortDirectionIA('asc');
    }
    setCurrentPageIA(1);
  };

  const SortIconIA = ({ column }: { column: SortColumnIA }) => {
    if (sortColumnIA !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirectionIA === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Seleção em lote IA
  const handleSelectAllIA = (checked: boolean, data: ContaPagar[]) => {
    if (checked) {
      setSelectedIdsIA(new Set(data.map(c => c.id)));
    } else {
      setSelectedIdsIA(new Set());
    }
  };

  const handleSelectOneIA = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIdsIA);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIdsIA(newSelected);
  };

  // Ações em lote IA
  const handleBatchUpdateDepartamentoIA = async () => {
    if (!batchDepartamentoIA) {
      toast.error("Selecione um departamento");
      return;
    }
    if (selectedIdsIA.size === 0) {
      toast.error("Selecione ao menos uma conta");
      return;
    }
    try {
      const dept = departamentos?.find(d => d.id === batchDepartamentoIA);
      const { error } = await supabase
        .from('contas_pagar')
        .update({ 
          departamento_id: batchDepartamentoIA,
          departamento_nome: dept?.nome || null 
        })
        .in('id', Array.from(selectedIdsIA));
      if (error) throw error;
      toast.success(`${selectedIdsIA.size} contas atualizadas!`);
      setSelectedIdsIA(new Set());
      setBatchDepartamentoIA("");
      invalidateContasQueries();
    } catch (error) {
      logger.error('Erro ao atualizar em lote:', error);
      toast.error('Erro ao atualizar contas');
    }
  };

  const handleBatchUpdatePlanoContasIA = async () => {
    if (!batchPlanoContasIA) {
      toast.error("Selecione um plano de contas");
      return;
    }
    if (selectedIdsIA.size === 0) {
      toast.error("Selecione ao menos uma conta");
      return;
    }
    try {
      const plano = planosContas?.find(p => p.id === batchPlanoContasIA);
      const { error } = await supabase
        .from('contas_pagar')
        .update({ 
          plano_contas_id: batchPlanoContasIA,
          plano_contas_codigo: plano?.code || null,
          plano_contas_nome: plano?.name || null 
        })
        .in('id', Array.from(selectedIdsIA));
      if (error) throw error;
      toast.success(`${selectedIdsIA.size} contas atualizadas!`);
      setSelectedIdsIA(new Set());
      setBatchPlanoContasIA("");
      invalidateContasQueries();
    } catch (error) {
      logger.error('Erro ao atualizar em lote:', error);
      toast.error('Erro ao atualizar contas');
    }
  };

  // Exportar para Excel (todas) — busca sob demanda no servidor com os filtros ativos
  const handleExport = async () => {
    toast.info("Preparando exportação...");
    const range = getDateRange(true);
    const params: Record<string, any> = { ...range };
    if (filterEmpresas.length > 0) params.empresa_ids = filterEmpresas.join(',');
    if (filterDepartamento !== 'all') params.departamento_id = filterDepartamento;
    if (filterPortadores.length > 0) params.portadores = filterPortadores.join(',');
    if (filterNatureza !== 'all') params.natureza_lancamento = filterNatureza;
    if (filterCentroCusto !== 'all') params.centro_custo_id = filterCentroCusto;
    if (filterPlanoContas !== 'all') params.plano_contas_id = filterPlanoContas;
    if (filterStatus !== 'all') params.status = filterStatus;
    if (searchFornecedor) params.search = searchFornecedor;
    let rows = await fetchAllViaApi(params);
    if (filterDiaPagamento) rows = rows.filter(r => r.data_pagamento === filterDiaPagamento);
    if (!rows || rows.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    const dataToExport = rows.map(c => ({
      empresa: c.empresa_nome,
      documento: `${c.numero_documento}/${c.parcela}`,
      fornecedor: c.fornecedor_nome,
      categoria: c.categoria_nome,
      emissao: formatLocalDate(c.data_emissao, 'dd/MM/yyyy'),
      vencimento: formatLocalDate(c.data_vencimento, 'dd/MM/yyyy'),
      valor_original: c.valor_original,
      valor_aberto: c.valor_aberto,
      valor_pago: c.valor_pago,
      status: calculateFinancialStatus(c.data_vencimento, c.data_pagamento, c.status, c.valor_aberto, c.valor_pago),
      portador: c.portador,
      conta: c.conta
    }));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BiMaster';
    const worksheet = workbook.addWorksheet('Contas a Pagar');
    worksheet.columns = [
      { header: 'Empresa', key: 'empresa', width: 20 },
      { header: 'Documento', key: 'documento', width: 15 },
      { header: 'Fornecedor', key: 'fornecedor', width: 30 },
      { header: 'Categoria', key: 'categoria', width: 20 },
      { header: 'Emissão', key: 'emissao', width: 12 },
      { header: 'Vencimento', key: 'vencimento', width: 12 },
      { header: 'Valor Original', key: 'valor_original', width: 15 },
      { header: 'Valor Aberto', key: 'valor_aberto', width: 15 },
      { header: 'Valor Pago', key: 'valor_pago', width: 15 },
      { header: 'Status (calculado)', key: 'status', width: 18 },
      { header: 'Portador', key: 'portador', width: 20 },
      { header: 'Conta', key: 'conta', width: 15 },
    ];
    dataToExport.forEach(row => worksheet.addRow(row));
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `contas-pagar-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success("Exportação concluída!");
  };


  const handleOpenApproval = (budget: any) => {
    setSelectedBudget(budget);
    setAprovarOrcamentoOpen(true);
  };

  const handleUpdateClassificacao = async (
    contaId: string, 
    departamentoId: string | null, 
    planoContasId: string | null
  ) => {
    try {
      const updates: any = {};
      
      if (departamentoId) {
        const dept = departamentos?.find(d => d.id === departamentoId);
        updates.departamento_id = departamentoId;
        updates.departamento_nome = dept?.nome || null;
      }
      
      if (planoContasId) {
        const plano = planosContas?.find(p => p.id === planoContasId);
        updates.plano_contas_id = planoContasId;
        updates.plano_contas_codigo = plano?.code || null;
        updates.plano_contas_nome = plano?.name || null;
      }

      const { error } = await supabase
        .from('contas_pagar')
        .update(updates)
        .eq('id', contaId);

      if (error) throw error;

      toast.success('Classificação atualizada com sucesso!');
      invalidateContasQueries();
    } catch (error) {
      logger.error('Erro ao atualizar classificação:', error);
      toast.error('Erro ao atualizar classificação');
    }
  };

  const getApprovalStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      approved: { variant: "default", label: "Aprovado" },
      pending: { variant: "secondary", label: "Pendente" },
      rejected: { variant: "destructive", label: "Rejeitado" }
    };

    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Resetar página ao mudar filtros
  const handleFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setCurrentPage(1);
    setSelectedIdsIA(new Set());
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between" data-tour="contas-pagar-header">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Receipt className="h-8 w-8" />
              Contas a Pagar & Orçamentos
            </h1>
            <p className="text-muted-foreground">Gestão de contas, fornecedores e plano orçamentário</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/financeiro">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Módulo Financeiro
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/financeiro/plano-contas">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Plano de Contas
                </Link>
              </Button>
              {isAdmin && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/dashboard/financeiro/contas-a-pagar/sync">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sincronização ERP
                  </Link>
                </Button>
              )}
              <Button variant="default" size="sm" asChild className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                <Link to="/dashboard/financeiro/contas-a-pagar/auditoria">
                  <Brain className="h-4 w-4 mr-2" />
                  Auditoria IA
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex gap-2" data-tour="contas-pagar-acoes">
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
            <Button onClick={() => setSolicitarOrcamentoOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Solicitar Orçamento
            </Button>
          </div>
        </div>

        {/* Barra de visualização — permite colapsar KPIs e Filtros para ganhar espaço */}
        {(() => {
          const activeFilters: string[] = [];
          if (filterAno !== 'all') activeFilters.push(`Ano: ${filterAno}`);
          if (filterMes !== 'all') activeFilters.push(`Mês: ${filterMes}`);
          if (filterEmpresas.length) activeFilters.push(`${filterEmpresas.length} empresa${filterEmpresas.length > 1 ? 's' : ''}`);
          if (filterDepartamento !== 'all') {
            const d = departamentos?.find(x => x.id === filterDepartamento);
            activeFilters.push(`Dept: ${d?.nome ?? '—'}`);
          }
          if (filterPortadores.length) activeFilters.push(`${filterPortadores.length} portador${filterPortadores.length > 1 ? 'es' : ''}`);
          if (filterCentroCusto !== 'all') activeFilters.push('C. Custo');
          if (filterPlanoContas !== 'all') activeFilters.push('Plano Contas');
          if (filterDiaVencimento) activeFilters.push(`Venc: ${filterDiaVencimento}`);
          if (filterDiaPagamento) activeFilters.push(`Pgto: ${filterDiaPagamento}`);
          return (
            <div className="flex items-center justify-between gap-2 flex-wrap border-b pb-2">
              <div className="flex items-center gap-1 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => setShowKpis(v => !v)} className="gap-2 h-8 text-muted-foreground hover:text-foreground">
                  {showKpis ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <BarChart3 className="h-4 w-4" />
                  {showKpis ? 'Ocultar indicadores' : 'Mostrar indicadores'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowFilters(v => !v)} className="gap-2 h-8 text-muted-foreground hover:text-foreground">
                  {showFilters ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <SlidersHorizontal className="h-4 w-4" />
                  {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                </Button>
              </div>
              {!showFilters && activeFilters.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeFilters.map((f) => (
                    <Badge key={f} variant="secondary" className="text-xs font-normal">{f}</Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Header consolidado de KPIs (fonte: fn_cp_dashboard v2 + fn_cp_kpis_avancados v2) */}
        {showKpis && (
          <div data-tour="contas-pagar-kpis">
            <ContasPagarHeaderKpis
              dashboard={cpHeadline}
              kpis={cpKpis}
              isLoading={isLoadingHeadline || isLoadingKpisAv}
              onOpenVencidos={() => {
                setFilterStatus('vencido');
                setActiveTab('contas');
              }}
            />
          </div>
        )}

        {/* Filtros Globais — padrão Central de Trabalho (toolbar compacta + popover avançado) */}
        {showFilters && (() => {
          const advancedActiveCount =
            (filterPortadores.length > 0 ? 1 : 0) +
            (filterCentroCusto !== 'all' ? 1 : 0) +
            (filterPlanoContas !== 'all' ? 1 : 0) +
            (filterDiaVencimento ? 1 : 0) +
            (filterDiaPagamento ? 1 : 0);

          const hasAnyFilter =
            searchFornecedor !== '' ||
            filterAno !== new Date().getFullYear().toString() ||
            filterMes !== 'all' ||
            filterEmpresas.length > 0 ||
            filterDepartamento !== 'all' ||
            advancedActiveCount > 0;

          const clearAdvanced = () => {
            setFilterPortadores([]);
            setFilterCentroCusto('all');
            setFilterPlanoContas('all');
            setFilterDiaVencimento('');
            setFilterDiaPagamento('');
            setCurrentPage(1);
          };

          const clearAll = () => {
            setFilterAno(new Date().getFullYear().toString());
            setFilterMes('all');
            setFilterEmpresas([]);
            setFilterDepartamento('all');
            setFilterConta('all');
            setFilterPortadores([]);
            setFilterDiaVencimento('');
            setFilterDiaPagamento('');
            setSearchFornecedor('');
            setFilterStatus('all');
            setFilterNatureza('all');
            setFilterCentroCusto('all');
            setFilterPlanoContas('all');
            setCurrentPage(1);
          };

          return (
            <div data-tour="contas-pagar-filtros" className="w-full flex flex-wrap items-center gap-2">
              {/* Busca fornecedor */}
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar fornecedor..."
                  value={searchFornecedor}
                  onChange={(e) => { setSearchFornecedor(e.target.value); setCurrentPage(1); }}
                  className="pl-8 h-9 text-sm"
                />
              </div>

              {/* Ano */}
              <Select
                value={filterAno}
                onValueChange={(value) => {
                  handleFilterChange(setFilterAno)(value);
                  if (value === 'all') setFilterMes('all');
                }}
              >
                <SelectTrigger className="w-[120px] h-9 text-xs">
                  <CalendarDays className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anos</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>

              {/* Mês */}
              <Select
                value={filterMes}
                onValueChange={handleFilterChange(setFilterMes)}
                disabled={filterAno === 'all'}
              >
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <CalendarDays className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  <SelectItem value="1">Janeiro</SelectItem>
                  <SelectItem value="2">Fevereiro</SelectItem>
                  <SelectItem value="3">Março</SelectItem>
                  <SelectItem value="4">Abril</SelectItem>
                  <SelectItem value="5">Maio</SelectItem>
                  <SelectItem value="6">Junho</SelectItem>
                  <SelectItem value="7">Julho</SelectItem>
                  <SelectItem value="8">Agosto</SelectItem>
                  <SelectItem value="9">Setembro</SelectItem>
                  <SelectItem value="10">Outubro</SelectItem>
                  <SelectItem value="11">Novembro</SelectItem>
                  <SelectItem value="12">Dezembro</SelectItem>
                </SelectContent>
              </Select>

              {/* Empresas (multi) */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 min-w-[160px] justify-between font-normal">
                    <span className="flex items-center gap-1.5 truncate">
                      <Building2 className="h-3.5 w-3.5" />
                      {filterEmpresas.length === 0
                        ? "Todas as empresas"
                        : filterEmpresas.length === 1
                          ? empresas.find(e => e.id === filterEmpresas[0])?.nome || "1 empresa"
                          : `${filterEmpresas.length} empresas`}
                    </span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <div className="p-2 border-b">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => { setFilterEmpresas([]); setCurrentPage(1); }}
                    >
                      <CheckCircle className={`mr-2 h-4 w-4 ${filterEmpresas.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                      Todas as empresas
                    </Button>
                  </div>
                  <div className="max-h-[220px] overflow-auto p-2 space-y-1">
                    {empresas.map(emp => (
                      <div key={emp.id} className="flex items-center space-x-2 p-1 hover:bg-muted rounded">
                        <Checkbox
                          id={`emp-${emp.id}`}
                          checked={filterEmpresas.includes(emp.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setFilterEmpresas([...filterEmpresas, emp.id]);
                            else setFilterEmpresas(filterEmpresas.filter(id => id !== emp.id));
                            setCurrentPage(1);
                          }}
                        />
                        <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer flex-1">{emp.nome}</label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Departamento */}
              <Select value={filterDepartamento} onValueChange={handleFilterChange(setFilterDepartamento)}>
                <SelectTrigger className="w-[170px] h-9 text-xs">
                  <Tags className="h-3.5 w-3.5 mr-1" />
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os departamentos</SelectItem>
                  {departamentos?.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtros avançados */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant={advancedActiveCount > 0 ? "default" : "outline"}
                    className="gap-1.5 h-9 text-xs"
                    aria-label="Filtros avançados"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Filtros avançados
                    {advancedActiveCount > 0 && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-0.5">
                        {advancedActiveCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[340px] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Filtros avançados</p>
                    {advancedActiveCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground"
                        onClick={clearAdvanced}
                      >
                        <X className="h-3 w-3" /> Limpar
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Portador</Label>
                    <div className="max-h-[160px] overflow-auto rounded-md border p-2 space-y-1">
                      {isLoadingPortadores ? (
                        <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
                          Carregando portadores...
                        </div>
                      ) : portadoresUnicos.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-1 py-2">Nenhum portador disponível.</p>
                      ) : portadoresUnicos.map(p => {
                        const checked = filterPortadores.includes(p);
                        return (
                          <label key={p} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) => {
                                if (c) setFilterPortadores([...filterPortadores, p]);
                                else setFilterPortadores(filterPortadores.filter(id => id !== p));
                                setCurrentPage(1);
                              }}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-xs truncate">{p}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Centro de Custo</Label>
                    <Select value={filterCentroCusto} onValueChange={handleFilterChange(setFilterCentroCusto)}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {centrosCusto.map(cc => (
                          <SelectItem key={cc.id} value={cc.id}>{cc.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Plano de Contas</Label>
                    <Select value={filterPlanoContas} onValueChange={handleFilterChange(setFilterPlanoContas)}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {planosContas?.map(pc => (
                          <SelectItem key={pc.id} value={pc.id}>{pc.code} — {pc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Dia Vencimento</Label>
                      <Input
                        type="date"
                        value={filterDiaVencimento}
                        onChange={(e) => handleFilterChange(setFilterDiaVencimento)(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Dia Pagamento</Label>
                      <Input
                        type="date"
                        value={filterDiaPagamento}
                        onChange={(e) => handleFilterChange(setFilterDiaPagamento)(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Limpar tudo */}
              {hasAnyFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-9 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  title="Limpar todos os filtros"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              )}
            </div>
          );
        })()}





        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6" data-tour="contas-pagar-tabs">
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="calendario" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="contas" className="gap-2">
              <Receipt className="h-4 w-4" />
              Contas a Pagar
            </TabsTrigger>
            <TabsTrigger value="orcamentos" className="gap-2">
              <FileText className="h-4 w-4" />
              Orçamentos
              {isAdmin && pendingBudgetsCount > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingBudgetsCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="classificacao" className="gap-2">
              <Brain className="h-4 w-4" />
              Classificação IA
            </TabsTrigger>
            <TabsTrigger value="visao-dre" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Ajuste para o DRE
            </TabsTrigger>
            <TabsTrigger value="comunicacao" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Comunicação
            </TabsTrigger>
            <Link to="/dashboard/financeiro/central-pagamentos">
              <Button variant="ghost" className="gap-2 h-9 px-3 text-sm font-medium">
                <CreditCard className="h-4 w-4" />
                Central de Pagamentos
              </Button>
            </Link>
          </TabsList>

          {/* Aba Dashboard Analítico — 100% agregados do servidor (mesma fonte da faixa oficial) */}
          <TabsContent value="dashboard" className="space-y-6" data-tour="contas-pagar-dashboard">
            <DashboardContasPagar dashboard={cpHeadline} kpis={cpKpis} isLoading={isLoadingHeadline || isLoadingKpisAv} />
          </TabsContent>

          {/* Aba Calendário de Vencimentos — busca só o mês visível (mantém drill-down por título) */}
          <TabsContent value="calendario" className="space-y-6">
            <CalendarioVencimentos
              filterEmpresas={filterEmpresas}
              filterDepartamento={filterDepartamento}
              filterPortadores={filterPortadores}
            />
          </TabsContent>

          {/* Aba Ajuste para o DRE */}
          <TabsContent value="visao-dre" className="space-y-6">
            <ContasPagarDREView 
              filterAno={filterAno}
              filterMes={filterMes}
              filterEmpresas={filterEmpresas}
              filterDepartamento={filterDepartamento}
            />
          </TabsContent>

          {/* Aba de Contas a Pagar */}
          <TabsContent value="contas" className="space-y-6">
            <ContasPagarTabContent
              filterEmpresas={filterEmpresas}
              filterAno={filterAno}
              filterMes={filterMes}
              filterDepartamento={filterDepartamento}
              filterPortadores={filterPortadores}
              filterDiaVencimento={filterDiaVencimento}
              filterDiaPagamento={filterDiaPagamento}
              filterConta={filterConta}
              filterNatureza={filterNatureza}
              filterCentroCusto={filterCentroCusto}
              filterPlanoContas={filterPlanoContas}
            />
          </TabsContent>

          {/* Aba de Orçamentos */}
          <TabsContent value="orcamentos" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Gestão de Orçamentos</CardTitle>
                  <Select value={budgetFilter} onValueChange={setBudgetFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="approved">Aprovados</SelectItem>
                      <SelectItem value="rejected">Rejeitados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingBudgets ? (
                  <div className="text-center py-8">Carregando orçamentos...</div>
                ) : budgets && budgets.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Solicitante</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Status</TableHead>
                          {isAdmin && <TableHead className="text-center">Ações</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {budgets.map((budget) => (
                          <TableRow key={budget.id}>
                            <TableCell>
                              <Badge variant="outline">{budget.code}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{budget.name}</TableCell>
                            <TableCell>{budget.profiles?.nome || 'N/A'}</TableCell>
                            <TableCell>
                              {format(new Date(budget.period_start), 'dd/MM/yy', { locale: ptBR })}
                              {' → '}
                              {format(new Date(budget.period_end), 'dd/MM/yy', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                              }).format(budget.total_amount)}
                            </TableCell>
                            <TableCell>
                              {getApprovalStatusBadge(budget.approval_status)}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-center">
                                {budget.approval_status === 'pending' ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenApproval(budget)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Revisar
                                  </Button>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum orçamento encontrado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba de Classificação IA */}
          <TabsContent value="classificacao" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      Classificação Automática com IA
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Use IA para classificar automaticamente contas sem departamento ou plano de contas
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          const ok = window.confirm(
                            "Reclassificar TODA a base histórica (inclusive contas classificadas manualmente) usando o Centro de Custo como âncora?\n\nEsta operação pode levar vários minutos e sobrescreve os valores atuais de Departamento e Plano de Contas."
                          );
                          if (ok) setReclassificarTudoOpen(true);
                        }}
                        className="gap-2"
                        title="Reclassifica todas as contas usando o Centro de Custo como referência principal"
                      >
                        <Bot className="h-4 w-4" />
                        Reclassificar TODA a base
                      </Button>
                    )}
                    <Button onClick={() => setClassificarIAOpen(true)} className="gap-2">
                      <Bot className="h-4 w-4" />
                      Classificar Pendentes
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Tabela de Contas Classificadas */}
                {isLoading ? (
                  <div className="text-center py-8">Carregando classificações...</div>
                ) : (() => {
                  // Filtrar por fornecedor e departamento
                  let contasFiltradas = contas || [];
                  if (filtroFornecedorIA) {
                    contasFiltradas = contasFiltradas.filter(c => c.fornecedor_nome === filtroFornecedorIA);
                  }
                  if (filtroDepartamentoIA) {
                    contasFiltradas = contasFiltradas.filter(c => c.departamento_id === filtroDepartamentoIA);
                  }

                  // Ordenar
                  const sortedData = [...contasFiltradas].sort((a, b) => {
                    let aVal: any = a[sortColumnIA as keyof ContaPagar];
                    let bVal: any = b[sortColumnIA as keyof ContaPagar];
                    if (aVal === null || aVal === undefined) aVal = '';
                    if (bVal === null || bVal === undefined) bVal = '';
                    if (sortColumnIA === 'valor_original') {
                      aVal = Number(aVal) || 0;
                      bVal = Number(bVal) || 0;
                    }
                    if (sortColumnIA === 'data_vencimento') {
                      aVal = aVal ? new Date(aVal).getTime() : 0;
                      bVal = bVal ? new Date(bVal).getTime() : 0;
                    }
                    if (aVal < bVal) return sortDirectionIA === 'asc' ? -1 : 1;
                    if (aVal > bVal) return sortDirectionIA === 'asc' ? 1 : -1;
                    return 0;
                  });

                  // Paginar
                  const totalItemsIA = sortedData.length;
                  const totalPagesIA = Math.ceil(totalItemsIA / pageSizeIA);
                  const startIndexIA = (currentPageIA - 1) * pageSizeIA;
                  const paginatedData = sortedData.slice(startIndexIA, startIndexIA + pageSizeIA);

                  const totalContas = contasFiltradas.length;
                  const classificadas = contasFiltradas.filter(c => c.departamento_id && c.plano_contas_id).length;
                  const pendentes = totalContas - classificadas;
                  const percentual = totalContas > 0 ? ((classificadas / totalContas) * 100).toFixed(1) : "0";

                  const isAllSelectedIA = paginatedData.length > 0 && paginatedData.every(c => selectedIdsIA.has(c.id));
                  const isSomeSelectedIA = paginatedData.some(c => selectedIdsIA.has(c.id)) && !isAllSelectedIA;

                  return (
                    <>
                      {/* KPIs de Classificação */}
                      <div className="grid gap-4 md:grid-cols-4 mb-6">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{totalContas}</div>
                            <p className="text-xs text-muted-foreground">Total de Contas</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-green-600">{classificadas}</div>
                            <p className="text-xs text-muted-foreground">Classificadas</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-orange-600">{pendentes}</div>
                            <p className="text-xs text-muted-foreground">Pendentes</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-primary">{percentual}%</div>
                            <p className="text-xs text-muted-foreground">Taxa de Classificação</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Filtros por Fornecedor e Departamento */}
                      <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <Select value={filtroFornecedorIA} onValueChange={(val) => { setFiltroFornecedorIA(val === "todos" ? "" : val); setCurrentPageIA(1); }}>
                          <SelectTrigger className="w-[220px] h-9">
                            <SelectValue placeholder="Filtrar por fornecedor..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            <SelectItem value="todos">Todos os fornecedores</SelectItem>
                            {[...new Set((contas || []).map(c => c.fornecedor_nome).filter(Boolean))].sort().map(f => (
                              <SelectItem key={f} value={f!}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={filtroDepartamentoIA} onValueChange={(val) => { setFiltroDepartamentoIA(val === "todos" ? "" : val); setCurrentPageIA(1); }}>
                          <SelectTrigger className="w-[200px] h-9">
                            <SelectValue placeholder="Filtrar por departamento..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos os departamentos</SelectItem>
                            {departamentos?.map(dept => (
                              <SelectItem key={dept.id} value={dept.id}>{dept.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {(filtroFornecedorIA || filtroDepartamentoIA) && (
                          <Button variant="ghost" size="sm" onClick={() => { setFiltroFornecedorIA(""); setFiltroDepartamentoIA(""); setCurrentPageIA(1); }}>
                            Limpar filtros
                          </Button>
                        )}
                      </div>
                      {/* Barra de Ações em Lote IA */}
                      {selectedIdsIA.size > 0 && (
                        <Card className="border-primary/50 bg-primary/5 mb-4">
                          <CardContent className="py-4">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-sm">
                                  {selectedIdsIA.size} {selectedIdsIA.size === 1 ? 'conta selecionada' : 'contas selecionadas'}
                                </Badge>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedIdsIA(new Set())}>
                                  Limpar seleção
                                </Button>
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                {/* Alterar Departamento */}
                                <div className="flex items-center gap-2">
                                  <Select value={batchDepartamentoIA} onValueChange={setBatchDepartamentoIA}>
                                    <SelectTrigger className="w-[160px] h-9">
                                      <Building2 className="h-4 w-4 mr-2" />
                                      <SelectValue placeholder="Departamento..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {departamentos?.map(dept => (
                                        <SelectItem key={dept.id} value={dept.id}>{dept.nome}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button size="sm" variant="secondary" onClick={handleBatchUpdateDepartamentoIA} disabled={!batchDepartamentoIA}>
                                    Aplicar
                                  </Button>
                                </div>
                                <div className="h-6 w-px bg-border" />
                                {/* Alterar Plano de Contas */}
                                <div className="flex items-center gap-2">
                                  <Select value={batchPlanoContasIA} onValueChange={setBatchPlanoContasIA}>
                                    <SelectTrigger className="w-[180px] h-9">
                                      <BookOpen className="h-4 w-4 mr-2" />
                                      <SelectValue placeholder="Plano de Contas..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {planosContas?.map(plano => (
                                        <SelectItem key={plano.id} value={plano.id}>
                                          {plano.code} - {plano.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button size="sm" variant="secondary" onClick={handleBatchUpdatePlanoContasIA} disabled={!batchPlanoContasIA}>
                                    Aplicar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Tabela */}
                      {paginatedData.length > 0 ? (
                        <>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[50px]">
                                    <Checkbox
                                      checked={isAllSelectedIA}
                                      onCheckedChange={(checked) => handleSelectAllIA(!!checked, paginatedData)}
                                      aria-label="Selecionar todos"
                                      className={isSomeSelectedIA ? "data-[state=checked]:bg-primary/50" : ""}
                                    />
                                  </TableHead>
                                  <TableHead className="w-[180px] cursor-pointer hover:bg-muted/50" onClick={() => handleSortIA('fornecedor_nome')}>
                                    <div className="flex items-center">Fornecedor<SortIconIA column="fornecedor_nome" /></div>
                                  </TableHead>
                                  <TableHead className="w-[100px] cursor-pointer hover:bg-muted/50" onClick={() => handleSortIA('numero_documento')}>
                                    <div className="flex items-center">Documento<SortIconIA column="numero_documento" /></div>
                                  </TableHead>
                                  <TableHead className="w-[90px] cursor-pointer hover:bg-muted/50" onClick={() => handleSortIA('data_vencimento')}>
                                    <div className="flex items-center">Vencimento<SortIconIA column="data_vencimento" /></div>
                                  </TableHead>
                                  <TableHead className="w-[100px] text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSortIA('valor_original')}>
                                    <div className="flex items-center justify-end">Valor<SortIconIA column="valor_original" /></div>
                                  </TableHead>
                                  <TableHead className="w-[80px] text-center">Origem</TableHead>
                                  <TableHead className="w-[180px] cursor-pointer hover:bg-muted/50" onClick={() => handleSortIA('departamento_nome')}>
                                    <div className="flex items-center">Departamento<SortIconIA column="departamento_nome" /></div>
                                  </TableHead>
                                  <TableHead className="w-[240px] cursor-pointer hover:bg-muted/50" onClick={() => handleSortIA('plano_contas_nome')}>
                                    <div className="flex items-center">Plano de Contas<SortIconIA column="plano_contas_nome" /></div>
                                  </TableHead>
                                  <TableHead className="w-[80px] text-center">Status</TableHead>
                                  <TableHead className="w-[60px] text-center">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {paginatedData.map((conta) => (
                                  <TableRow key={conta.id} className={selectedIdsIA.has(conta.id) ? "bg-primary/5" : ""}>
                                    <TableCell>
                                      <Checkbox
                                        checked={selectedIdsIA.has(conta.id)}
                                        onCheckedChange={(checked) => handleSelectOneIA(conta.id, !!checked)}
                                        aria-label={`Selecionar ${conta.fornecedor_nome}`}
                                      />
                                    </TableCell>
                                    <TableCell className="font-medium truncate max-w-[180px]" title={conta.fornecedor_nome || 'N/A'}>
                                      {conta.fornecedor_nome || 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="text-xs">
                                        {conta.numero_documento}/{conta.parcela}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {formatLocalDate(conta.data_vencimento, 'dd/MM/yy')}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-xs">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor_original || 0)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {conta.classificacao_manual ? (
                                        <Badge variant="default" className="gap-1 text-xs">
                                          <User className="h-3 w-3" />Manual
                                        </Badge>
                                      ) : conta.classificado_automaticamente ? (
                                        <Badge variant="secondary" className="gap-1 text-xs">
                                          <Bot className="h-3 w-3" />
                                          {conta.confianca_classificacao ? `${(conta.confianca_classificacao * 100).toFixed(0)}%` : 'IA'}
                                        </Badge>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        {conta.classificacao_manual && <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                                        <Select
                                          value={conta.departamento_id || ""}
                                          onValueChange={(value) => handleUpdateClassificacao(conta.id, value || null, conta.plano_contas_id)}
                                        >
                                          <SelectTrigger className="w-full h-8 text-xs">
                                            <SelectValue placeholder="Selecione...">{conta.departamento_nome || "Selecione..."}</SelectValue>
                                          </SelectTrigger>
                                          <SelectContent className="bg-background z-[100]">
                                            {departamentos?.map((dept) => (
                                              <SelectItem key={dept.id} value={dept.id}>{dept.nome}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={conta.plano_contas_id || ""}
                                        onValueChange={(value) => handleUpdateClassificacao(conta.id, conta.departamento_id, value || null)}
                                      >
                                        <SelectTrigger className="w-full h-8 text-xs">
                                          <SelectValue placeholder="Selecione...">
                                            {conta.plano_contas_codigo && conta.plano_contas_nome 
                                              ? `${conta.plano_contas_codigo} - ${conta.plano_contas_nome}` : "Selecione..."}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent className="bg-background z-[100]">
                                          {planosContas?.map((plano) => (
                                            <SelectItem key={plano.id} value={plano.id}>
                                              <div className="flex flex-col">
                                                <span className="font-medium">{plano.code}</span>
                                                <span className="text-xs text-muted-foreground">{plano.name}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {conta.departamento_id && conta.plano_contas_id ? (
                                        <Badge variant="default" className="gap-1 text-xs"><CheckCircle className="h-3 w-3" />OK</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="gap-1 text-xs"><Clock className="h-3 w-3" />Pend</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => {
                                          setSelectedContaClassificacao(conta);
                                          setEditarClassificacaoOpen(true);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Paginação IA */}
                          <div className="flex items-center justify-between mt-4 pt-4 border-t">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>Mostrando</span>
                              <Select 
                                value={pageSizeIA.toString()} 
                                onValueChange={(value) => {
                                  setPageSizeIA(Number(value));
                                  setCurrentPageIA(1);
                                }}
                              >
                                <SelectTrigger className="w-[70px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="10">10</SelectItem>
                                  <SelectItem value="25">25</SelectItem>
                                  <SelectItem value="50">50</SelectItem>
                                  <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                              </Select>
                              <span>de {totalItemsIA} registros</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => setCurrentPageIA(1)} disabled={currentPageIA === 1}>
                                <ChevronsLeft className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setCurrentPageIA(prev => Math.max(1, prev - 1))} disabled={currentPageIA === 1}>
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <span className="text-sm px-2">Página {currentPageIA} de {totalPagesIA || 1}</span>
                              <Button variant="outline" size="sm" onClick={() => setCurrentPageIA(prev => Math.min(totalPagesIA, prev + 1))} disabled={currentPageIA >= totalPagesIA}>
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setCurrentPageIA(totalPagesIA)} disabled={currentPageIA >= totalPagesIA}>
                                <ChevronsRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Nenhuma conta encontrada para o período selecionado
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Comunicação */}
          <TabsContent value="comunicacao" className="space-y-6">
            <PaymentChatConsolidado />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <ClassificarContasPagarDialog
          open={classificarIAOpen}
          onOpenChange={setClassificarIAOpen}
          onComplete={() => {
            invalidateContasQueries();
            setSelectedIdsIA(new Set());
            toast.success("Classificação concluída! Atualizando lista...");
          }}
        />

        <ClassificarContasPagarDialog
          open={reclassificarTudoOpen}
          onOpenChange={setReclassificarTudoOpen}
          forceReclassifyAll
          onComplete={() => {
            invalidateContasQueries();
            setSelectedIdsIA(new Set());
            toast.success("Reclassificação concluída! Atualizando lista...");
          }}
        />

        <EditarClassificacaoRapidaDialog
          open={editarClassificacaoOpen}
          onOpenChange={setEditarClassificacaoOpen}
          conta={selectedContaClassificacao}
          onSuccess={invalidateContasQueries}
        />

        <SolicitarOrcamentoDialog
          open={solicitarOrcamentoOpen}
          onOpenChange={setSolicitarOrcamentoOpen}
          onSuccess={refetchBudgets}
        />
        
        <AprovarOrcamentoDialog
          open={aprovarOrcamentoOpen}
          onOpenChange={setAprovarOrcamentoOpen}
          budget={selectedBudget}
          onSuccess={refetchBudgets}
        />
        {/* Sofia Floating Chat */}
        <SofiaFloatingChat contasData={contas} />
        
        {/* Tour Button */}
        <TourButton 
          tourId={CONTAS_PAGAR_TOUR_ID}
          tourSteps={contasPagarTourSteps}
        />
      </div>
    </DashboardLayout>
  );
}
