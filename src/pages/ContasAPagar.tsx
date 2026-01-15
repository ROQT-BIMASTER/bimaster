import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { 
  Download, Receipt, AlertCircle, CheckCircle, Clock, TrendingUp, Plus, FileText, Eye, BookOpen, 
  ArrowLeft, Brain, Bot, Pencil, User, Lock, ArrowUpDown, ArrowUp, ArrowDown, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, Tags, Building2, LayoutDashboard, CalendarDays, ChevronsUpDown, RefreshCw
} from "lucide-react";
import { DashboardContasPagar } from "@/components/financeiro/DashboardContasPagar";
import { CalendarioVencimentos } from "@/components/financeiro/CalendarioVencimentos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from 'xlsx';
import { toast } from "sonner";
import { SolicitarOrcamentoDialog } from "@/components/trade/SolicitarOrcamentoDialog";
import { AprovarOrcamentoDialog } from "@/components/trade/AprovarOrcamentoDialog";
import { ClassificarContasPagarDialog } from "@/components/configuracoes/ClassificarContasPagarDialog";
import { EditarClassificacaoRapidaDialog } from "@/components/financeiro/EditarClassificacaoRapidaDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { calculateFinancialStatus } from "@/hooks/useFinancialStatus";
import { formatLocalDate } from "@/utils/dateUtils";

interface ContaPagar {
  id: string;
  erp_id: string;
  empresa_id: number;
  empresa_nome: string;
  tipo_documento: string;
  numero_documento: string;
  parcela: number;
  fornecedor_codigo: string;
  fornecedor_nome: string;
  valor_original: number;
  valor_aberto: number;
  valor_pago: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  categoria_nome: string;
  status: string;
  portador: string;
  conta: string;
  departamento_id: string | null;
  departamento_nome: string | null;
  plano_contas_id: string | null;
  plano_contas_codigo: string | null;
  plano_contas_nome: string | null;
  confianca_classificacao: number | null;
  classificacao_justificativa: string | null;
  classificado_automaticamente: boolean | null;
  classificado_em: string | null;
  classificacao_manual: boolean | null;
  classificacao_corrigida_por: string | null;
  classificacao_corrigida_em: string | null;
}

type SortColumn = 'empresa_nome' | 'numero_documento' | 'fornecedor_nome' | 'categoria_nome' | 'data_vencimento' | 'valor_original' | 'valor_aberto' | 'status';
type SortColumnIA = 'fornecedor_nome' | 'numero_documento' | 'data_vencimento' | 'valor_original' | 'departamento_nome' | 'plano_contas_nome';
type SortDirection = 'asc' | 'desc';

export default function ContasAPagar() {
  const { userType, isAdmin } = useUserRole();
  
  // Filtros
  const [searchFornecedor, setSearchFornecedor] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmpresas, setFilterEmpresas] = useState<number[]>([]);
  const [filterAno, setFilterAno] = useState<string>(new Date().getFullYear().toString());
  const [filterMes, setFilterMes] = useState<string>("all");
  const [filterDepartamento, setFilterDepartamento] = useState<string>("all");
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Ordenação
  const [sortColumn, setSortColumn] = useState<SortColumn>('data_vencimento');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Seleção em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Dialogs
  const [solicitarOrcamentoOpen, setSolicitarOrcamentoOpen] = useState(false);
  const [aprovarOrcamentoOpen, setAprovarOrcamentoOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<any>(null);
  const [budgetFilter, setBudgetFilter] = useState<string>("all");
  const [classificarIAOpen, setClassificarIAOpen] = useState(false);
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

  // Função para construir filtros base (reutilizada em ambas queries)
  const buildBaseFilters = (query: any) => {
    let q = query;
    
    if (filterEmpresas.length > 0) {
      q = q.in('empresa_id', filterEmpresas);
    }

    if (filterDepartamento !== 'all') {
      q = q.eq('departamento_id', filterDepartamento);
    }

    if (filterAno !== 'all') {
      const startDate = `${filterAno}-01-01`;
      const endDate = `${filterAno}-12-31`;
      q = q.gte('data_vencimento', startDate).lte('data_vencimento', endDate);
    }

    if (filterMes !== 'all' && filterAno !== 'all') {
      const mes = filterMes.padStart(2, '0');
      const startDate = `${filterAno}-${mes}-01`;
      const lastDay = new Date(parseInt(filterAno), parseInt(filterMes), 0).getDate();
      const endDate = `${filterAno}-${mes}-${lastDay}`;
      q = q.gte('data_vencimento', startDate).lte('data_vencimento', endDate);
    }
    
    return q;
  };

  // Query para DASHBOARD - busca todos os dados do período (sem paginação, limite alto)
  const { data: contasDashboard, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ['contas-pagar-dashboard', filterEmpresasKey, filterAno, filterMes, filterDepartamento],
    queryFn: async () => {
      let query = supabase
        .from('contas_pagar')
        .select('*');
      
      query = buildBaseFilters(query);
      
      // Sem ordenação específica e limite maior para garantir todos os dados
      const { data, error } = await query.limit(100000);
      if (error) throw error;
      return data as ContaPagar[];
    }
  });

  // Query para TABELA - com paginação no backend
  const { data: contasTable, isLoading: isLoadingTable, refetch: refetchContas } = useQuery({
    queryKey: ['contas-pagar-table', searchFornecedor, filterStatus, filterEmpresasKey, filterAno, filterMes, filterDepartamento, sortColumn, sortDirection, currentPage, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('contas_pagar')
        .select('*', { count: 'exact' });

      if (searchFornecedor) {
        query = query.ilike('fornecedor_nome', `%${searchFornecedor}%`);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      query = buildBaseFilters(query);

      // Ordenação no backend
      const ascending = sortDirection === 'asc';
      query = query.order(sortColumn, { ascending });

      // Paginação no backend
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as ContaPagar[], count: count || 0 };
    }
  });

  // Dados para compatibilidade (usado em KPIs, exports, etc.)
  const contasBase = contasDashboard;

  // Aplica filtros da aba (Status + Busca) também nos dados usados por Dashboard/Calendário/KPIs.
  // Fazemos isso em memória para não refazer uma query gigante a cada tecla.
  const contas = useMemo(() => {
    let list = contasBase || [];

    if (filterStatus !== 'all') {
      const status = filterStatus.toLowerCase();
      list = list.filter(c => (c.status || '').toLowerCase() === status);
    }

    const search = searchFornecedor.trim().toLowerCase();
    if (search) {
      list = list.filter(c => (c.fornecedor_nome || '').toLowerCase().includes(search));
    }

    return list;
  }, [contasBase, filterStatus, searchFornecedor]);

  const isLoading = isLoadingDashboard || isLoadingTable;

  // Dados paginados da tabela
  const sortedAndPaginatedData = useMemo(() => {
    if (!contasTable) return { data: [], totalPages: 0, totalItems: 0 };
    
    const totalItems = contasTable.count;
    const totalPages = Math.ceil(totalItems / pageSize);
    
    return { data: contasTable.data, totalPages, totalItems };
  }, [contasTable, pageSize]);

  // Calcular KPIs com status do banco como fonte da verdade
  const kpis = useMemo(() => {
    if (!contas) return { totalAPagar: 0, vencendoHoje: 0, vencidas: 0, pagasNoMes: 0 };
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = format(hoje, 'yyyy-MM-dd');
    const hojeKey = format(hoje, 'yyyy-MM');
    
    return {
      totalAPagar: contas.filter(c => {
        const statusCalc = calculateFinancialStatus(c.data_vencimento, c.data_pagamento, c.status);
        return ['pendente', 'vencido', 'parcial'].includes(statusCalc);
      }).reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      
      vencendoHoje: contas.filter(c => {
        const vencKey = c.data_vencimento ? c.data_vencimento.substring(0, 10) : '';
        const statusLower = (c.status || '').toLowerCase();
        return vencKey === hojeStr && statusLower !== 'pago';
      }).reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      
      vencidas: contas.filter(c => {
        const statusCalc = calculateFinancialStatus(c.data_vencimento, c.data_pagamento, c.status);
        return statusCalc === 'vencido';
      }).reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
      
      pagasNoMes: contas.filter(c => {
        const statusLower = (c.status || '').toLowerCase();
        if (statusLower !== 'pago') return false;
        if (!c.data_pagamento) return false;
        return c.data_pagamento.substring(0, 7) === hojeKey;
      }).reduce((sum, c) => sum + (c.valor_pago || 0), 0)
    };
  }, [contas]);

  // Empresas únicas para filtro (somente filtros globais: ano/mês/empresa/departamento)
  const empresas = Array.from(new Set(contasBase?.map(c => ({ id: c.empresa_id, nome: c.empresa_nome })) || []))
    .reduce((acc, curr) => {
      if (!acc.find(e => e.id === curr.id)) acc.push(curr);
      return acc;
    }, [] as { id: number; nome: string }[]);

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

  // Funções de ordenação
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset para primeira página ao ordenar
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Funções de seleção
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedAndPaginatedData.data.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const isAllSelected = sortedAndPaginatedData.data.length > 0 && 
    sortedAndPaginatedData.data.every(c => selectedIds.has(c.id));
  const isSomeSelected = sortedAndPaginatedData.data.some(c => selectedIds.has(c.id)) && !isAllSelected;

  // Ações em lote
  const handleBatchExport = () => {
    const selectedContas = contas?.filter(c => selectedIds.has(c.id));
    if (!selectedContas || selectedContas.length === 0) {
      toast.error("Selecione ao menos uma conta para exportar");
      return;
    }

    const dataToExport = selectedContas.map(c => ({
      'Empresa': c.empresa_nome,
      'Documento': `${c.numero_documento}/${c.parcela}`,
      'Fornecedor': c.fornecedor_nome,
      'Categoria': c.categoria_nome,
      'Emissão': formatLocalDate(c.data_emissao, 'dd/MM/yyyy'),
      'Vencimento': formatLocalDate(c.data_vencimento, 'dd/MM/yyyy'),
      'Valor Original': c.valor_original,
      'Valor Aberto': c.valor_aberto,
      'Valor Pago': c.valor_pago,
      'Status': c.status,
      'Departamento': c.departamento_nome || '',
      'Plano de Contas': c.plano_contas_nome || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas Selecionadas");
    XLSX.writeFile(wb, `contas-selecionadas-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success(`${selectedContas.length} contas exportadas!`);
    setSelectedIds(new Set());
  };

  const handleBatchUpdateDepartamento = async () => {
    if (!batchDepartamento) {
      toast.error("Selecione um departamento");
      return;
    }

    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma conta");
      return;
    }

    try {
      const dept = departamentos?.find(d => d.id === batchDepartamento);
      
      const { error } = await supabase
        .from('contas_pagar')
        .update({ 
          departamento_id: batchDepartamento,
          departamento_nome: dept?.nome || null 
        })
        .in('id', Array.from(selectedIds));

      if (error) throw error;

      toast.success(`${selectedIds.size} contas atualizadas!`);
      setSelectedIds(new Set());
      setBatchDepartamento("");
      refetchContas();
    } catch (error) {
      console.error('Erro ao atualizar em lote:', error);
      toast.error('Erro ao atualizar contas');
    }
  };

  const handleBatchClassificar = () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos uma conta");
      return;
    }
    setClassificarIAOpen(true);
  };

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
      refetchContas();
    } catch (error) {
      console.error('Erro ao atualizar em lote:', error);
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
      refetchContas();
    } catch (error) {
      console.error('Erro ao atualizar em lote:', error);
      toast.error('Erro ao atualizar contas');
    }
  };

  // Exportar para Excel (todas)
  const handleExport = () => {
    if (!contas || contas.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    const dataToExport = contas.map(c => ({
      'Empresa': c.empresa_nome,
      'Documento': `${c.numero_documento}/${c.parcela}`,
      'Fornecedor': c.fornecedor_nome,
      'Categoria': c.categoria_nome,
      'Emissão': formatLocalDate(c.data_emissao, 'dd/MM/yyyy'),
      'Vencimento': formatLocalDate(c.data_vencimento, 'dd/MM/yyyy'),
      'Valor Original': c.valor_original,
      'Valor Aberto': c.valor_aberto,
      'Valor Pago': c.valor_pago,
      'Status': c.status,
      'Portador': c.portador,
      'Conta': c.conta
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Pagar");
    XLSX.writeFile(wb, `contas-pagar-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success("Exportação concluída!");
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pago: { variant: "default", icon: CheckCircle },
      parcial: { variant: "secondary", icon: Clock },
      vencido: { variant: "destructive", icon: AlertCircle },
      pendente: { variant: "outline", icon: Clock }
    };

    const config = variants[status] || variants.pendente;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
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
      refetchContas();
    } catch (error) {
      console.error('Erro ao atualizar classificação:', error);
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
    setSelectedIds(new Set());
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
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
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/financeiro/contas-a-pagar/sync">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronização ERP
                </Link>
              </Button>
              <Button variant="default" size="sm" asChild className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                <Link to="/dashboard/financeiro/contas-a-pagar/auditoria">
                  <Brain className="h-4 w-4 mr-2" />
                  Auditoria IA
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
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

        {/* KPI - Pagas no Mês */}
        <div className="grid gap-4 md:grid-cols-1 max-w-sm">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagas no Mês</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.pagasNoMes)}
              </div>
              <p className="text-xs text-muted-foreground">Pagamentos realizados</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros Globais */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Ano</label>
                <Select value={filterAno} onValueChange={(value) => {
                  handleFilterChange(setFilterAno)(value);
                  if (value === 'all') setFilterMes('all');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Mês</label>
                <Select 
                  value={filterMes} 
                  onValueChange={handleFilterChange(setFilterMes)}
                  disabled={filterAno === 'all'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
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
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Empresa</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {filterEmpresas.length === 0 
                        ? "Todas as empresas" 
                        : filterEmpresas.length === 1 
                          ? empresas.find(e => e.id === filterEmpresas[0])?.nome || "1 empresa"
                          : `${filterEmpresas.length} empresas`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <div className="p-2 border-b">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={() => {
                          setFilterEmpresas([]);
                          setCurrentPage(1);
                        }}
                      >
                        <CheckCircle className={`mr-2 h-4 w-4 ${filterEmpresas.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                        Todas as empresas
                      </Button>
                    </div>
                    <div className="max-h-[200px] overflow-auto p-2 space-y-1">
                      {empresas.map(emp => (
                        <div key={emp.id} className="flex items-center space-x-2 p-1 hover:bg-muted rounded">
                          <Checkbox
                            id={`emp-${emp.id}`}
                            checked={filterEmpresas.includes(emp.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFilterEmpresas([...filterEmpresas, emp.id]);
                              } else {
                                setFilterEmpresas(filterEmpresas.filter(id => id !== emp.id));
                              }
                              setCurrentPage(1);
                            }}
                          />
                          <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer flex-1">
                            {emp.nome}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Departamento</label>
                <Select value={filterDepartamento} onValueChange={handleFilterChange(setFilterDepartamento)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {departamentos?.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-6">
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
          </TabsList>

          {/* Aba Dashboard Analítico */}
          <TabsContent value="dashboard" className="space-y-6">
            <DashboardContasPagar contas={contas} isLoading={isLoading} />
          </TabsContent>

          {/* Aba Calendário de Vencimentos */}
          <TabsContent value="calendario" className="space-y-6">
            <CalendarioVencimentos contas={contas} isLoading={isLoading} />
          </TabsContent>

          {/* Aba de Contas a Pagar */}
          <TabsContent value="contas" className="space-y-6">
            {/* Filtros específicos da aba */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select value={filterStatus} onValueChange={handleFilterChange(setFilterStatus)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="vencido">Vencido</SelectItem>
                        <SelectItem value="parcial">Parcial</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm font-medium mb-2 block">Buscar Fornecedor</label>
                    <Input
                      placeholder="Digite o nome do fornecedor..."
                      value={searchFornecedor}
                      onChange={(e) => {
                        setSearchFornecedor(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Barra de Ações em Lote */}
            {selectedIds.size > 0 && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm">
                        {selectedIds.size} {selectedIds.size === 1 ? 'conta selecionada' : 'contas selecionadas'}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedIds(new Set())}
                      >
                        Limpar seleção
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Alterar Departamento em Lote */}
                      <div className="flex items-center gap-2">
                        <Select value={batchDepartamento} onValueChange={setBatchDepartamento}>
                          <SelectTrigger className="w-[180px] h-9">
                            <Building2 className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Departamento..." />
                          </SelectTrigger>
                          <SelectContent>
                            {departamentos?.map(dept => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={handleBatchUpdateDepartamento}
                          disabled={!batchDepartamento}
                        >
                          Aplicar
                        </Button>
                      </div>

                      <div className="h-6 w-px bg-border" />

                      {/* Classificar IA */}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleBatchClassificar}
                        className="gap-2"
                      >
                        <Bot className="h-4 w-4" />
                        Classificar IA
                      </Button>

                      {/* Exportar Selecionadas */}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleBatchExport}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Exportar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabela de Contas */}
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : contas && contas.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">
                              <Checkbox
                                checked={isAllSelected}
                                onCheckedChange={handleSelectAll}
                                aria-label="Selecionar todos"
                                className={isSomeSelected ? "data-[state=checked]:bg-primary/50" : ""}
                              />
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleSort('empresa_nome')}
                            >
                              <div className="flex items-center">
                                Empresa
                                <SortIcon column="empresa_nome" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleSort('numero_documento')}
                            >
                              <div className="flex items-center">
                                Documento
                                <SortIcon column="numero_documento" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleSort('fornecedor_nome')}
                            >
                              <div className="flex items-center">
                                Fornecedor
                                <SortIcon column="fornecedor_nome" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleSort('categoria_nome')}
                            >
                              <div className="flex items-center">
                                Categoria
                                <SortIcon column="categoria_nome" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleSort('data_vencimento')}
                            >
                              <div className="flex items-center">
                                Vencimento
                                <SortIcon column="data_vencimento" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 transition-colors text-right"
                              onClick={() => handleSort('valor_original')}
                            >
                              <div className="flex items-center justify-end">
                                Valor Original
                                <SortIcon column="valor_original" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 transition-colors text-right"
                              onClick={() => handleSort('valor_aberto')}
                            >
                              <div className="flex items-center justify-end">
                                Valor Aberto
                                <SortIcon column="valor_aberto" />
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleSort('status')}
                            >
                              <div className="flex items-center">
                                Status
                                <SortIcon column="status" />
                              </div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedAndPaginatedData.data.map((conta) => (
                            <TableRow 
                              key={conta.id}
                              className={selectedIds.has(conta.id) ? "bg-primary/5" : ""}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(conta.id)}
                                  onCheckedChange={(checked) => handleSelectOne(conta.id, !!checked)}
                                  aria-label={`Selecionar ${conta.fornecedor_nome}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{conta.empresa_nome}</TableCell>
                              <TableCell>{conta.numero_documento}/{conta.parcela}</TableCell>
                              <TableCell>{conta.fornecedor_nome}</TableCell>
                              <TableCell>{conta.categoria_nome}</TableCell>
                              <TableCell>
                                {formatLocalDate(conta.data_vencimento, 'dd/MM/yyyy')}
                              </TableCell>
                              <TableCell className="text-right">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor_original)}
                              </TableCell>
                              <TableCell className="text-right">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor_aberto)}
                              </TableCell>
                              <TableCell>{getStatusBadge(conta.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Paginação */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Mostrando</span>
                        <Select 
                          value={pageSize.toString()} 
                          onValueChange={(value) => {
                            setPageSize(Number(value));
                            setCurrentPage(1);
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
                        <span>de {sortedAndPaginatedData.totalItems} registros</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        
                        <span className="text-sm px-2">
                          Página {currentPage} de {sortedAndPaginatedData.totalPages || 1}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(sortedAndPaginatedData.totalPages, prev + 1))}
                          disabled={currentPage >= sortedAndPaginatedData.totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(sortedAndPaginatedData.totalPages)}
                          disabled={currentPage >= sortedAndPaginatedData.totalPages}
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma conta encontrada
                  </div>
                )}
              </CardContent>
            </Card>
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
                  <Button onClick={() => setClassificarIAOpen(true)} className="gap-2">
                    <Bot className="h-4 w-4" />
                    Classificar Pendentes
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Tabela de Contas Classificadas */}
                {isLoading ? (
                  <div className="text-center py-8">Carregando classificações...</div>
                ) : (() => {
                  // Usa os dados já filtrados globalmente
                  const contasFiltradas = contas || [];

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
        </Tabs>

        {/* Dialogs */}
        <ClassificarContasPagarDialog
          open={classificarIAOpen}
          onOpenChange={setClassificarIAOpen}
          onComplete={() => {
            refetchContas();
            setSelectedIds(new Set());
            toast.success("Classificação concluída! Atualizando lista...");
          }}
        />

        <EditarClassificacaoRapidaDialog
          open={editarClassificacaoOpen}
          onOpenChange={setEditarClassificacaoOpen}
          conta={selectedContaClassificacao}
          onSuccess={refetchContas}
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
      </div>
    </DashboardLayout>
  );
}
