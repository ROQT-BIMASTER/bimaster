import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Download, Receipt, AlertCircle, CheckCircle, Clock, ArrowLeft, Building2, ChevronsUpDown, 
  LayoutDashboard, CalendarDays, TableIcon, AlertTriangle, RefreshCw, Upload,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Eye, ChevronDown, FileBarChart, Landmark
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatLocalDate } from "@/utils/dateUtils";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { toast } from "sonner";
import { DashboardContasReceberAggregated } from "@/components/financeiro/DashboardContasReceberAggregated";
import { CalendarioRecebimentosAggregated } from "@/components/financeiro/CalendarioRecebimentosAggregated";
import ImportarContasReceberCSV from "@/components/financeiro/ImportarContasReceberCSV";
import { useEmpresaFilter } from "@/hooks/useEmpresaFilter";
import { useUIPermissions } from "@/hooks/useUIPermissions";

interface ContaReceber {
  id: string;
  erp_id: string;
  empresa_id: number;
  empresa_nome: string;
  tipo_documento: string;
  numero_documento: string;
  parcela: number;
  cliente_codigo: string;
  cliente_nome: string;
  vendedor_codigo: string;
  vendedor_nome: string;
  valor_original: number;
  valor_aberto: number;
  valor_recebido: number;
  valor_juros: number;
  valor_desconto: number;
  data_emissao: string;
  data_vencimento: string;
  data_recebimento: string | null;
  status: string;
  portador: string;
  conta: string;
  created_at: string;
}

type SortColumn = 'empresa_nome' | 'numero_documento' | 'cliente_nome' | 'vendedor_nome' | 'data_vencimento' | 'valor_original' | 'valor_aberto' | 'status';
type SortDirection = 'asc' | 'desc';

export default function ContasAReceber() {
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const { empresaIds: contextEmpresaIds, loading: loadingEmpresas } = useEmpresaFilter();
  // ADV-7: UI permission for receivables management
  const { canEdit: canManageRecebimento } = useUIPermissions("financeiro_contas_receber");
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedCR, setSelectedCR] = useState<ContaReceber | null>(null);
  const [searchCliente, setSearchCliente] = useState("");
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
  const [filterAnos, setFilterAnos] = useState<number[]>([new Date().getFullYear()]);
  const [filterMeses, setFilterMeses] = useState<number[]>([]);
  const [filterConta, setFilterConta] = useState<string>("all");
  const [filterPortador, setFilterPortador] = useState<string>("all");
  const [filterDiaVencimento, setFilterDiaVencimento] = useState<string>("");
  const [filterDiaRecebimento, setFilterDiaRecebimento] = useState<string>("");
  const [filterDiaEmissao, setFilterDiaEmissao] = useState<string>("");
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Ordenação
  const [sortColumn, setSortColumn] = useState<SortColumn>('data_vencimento');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // OTIMIZAÇÃO: Removida invalidação agressiva de cache ao montar componente
  // O staleTime global do React Query já garante dados frescos quando necessário
  // Isso evita requisições desnecessárias ao navegar entre páginas

  // IMPORTANTE: nunca usar .sort() direto no state (muta o array e quebra refresh/cache)
  const sortedEmpresas = useMemo(() => [...filterEmpresas].sort((a, b) => a - b), [filterEmpresas]);
  const sortedAnos = useMemo(() => [...filterAnos].sort((a, b) => a - b), [filterAnos]);
  const sortedMeses = useMemo(() => [...filterMeses].sort((a, b) => a - b), [filterMeses]);

  // Converte filtros para string para o queryKey detectar mudanças corretamente
  const filterEmpresasKey = sortedEmpresas.length > 0 ? sortedEmpresas.join(',') : 'all';
  const filterAnosKey = sortedAnos.length > 0 ? sortedAnos.join(',') : 'all';
  const filterMesesKey = sortedMeses.length > 0 ? sortedMeses.join(',') : 'all';

  // Função para construir filtros base (reutilizada em todas queries)
  const buildBaseFilters = (query: any) => {
    let q = query;

    if (filterEmpresas.length > 0) {
      q = q.in('empresa_id', filterEmpresas);
    }

    // Filtro Conta Bancária
    if (filterConta !== 'all') {
      q = q.eq('conta', filterConta);
    }

    // Filtro Portador
    if (filterPortador !== 'all') {
      q = q.eq('portador', filterPortador);
    }

    // Filtro Dia Vencimento (data específica)
    if (filterDiaVencimento) {
      q = q.eq('data_vencimento', filterDiaVencimento);
    }

    // Filtro Dia Recebimento (data específica)
    if (filterDiaRecebimento) {
      q = q.eq('data_recebimento', filterDiaRecebimento);
    }

    // Filtro Dia Emissão (data específica)
    if (filterDiaEmissao) {
      q = q.eq('data_emissao', filterDiaEmissao);
    }

    // Filtro por ano - múltiplos anos ou últimos 3 anos + 1 futuro se vazio
    if (filterAnos.length === 0) {
      const hoje = new Date();
      const anoAtual = hoje.getFullYear();
      const startDate = `${anoAtual - 3}-01-01`;
      const endDate = `${anoAtual + 1}-12-31`;
      q = q.gte('data_vencimento', startDate).lte('data_vencimento', endDate);
    } else if (filterAnos.length === 1) {
      const startDate = `${filterAnos[0]}-01-01`;
      const endDate = `${filterAnos[0]}-12-31`;
      q = q.gte('data_vencimento', startDate).lte('data_vencimento', endDate);
    } else {
      // Múltiplos anos - buscar intervalo entre menor e maior
      const minAno = Math.min(...filterAnos);
      const maxAno = Math.max(...filterAnos);
      const startDate = `${minAno}-01-01`;
      const endDate = `${maxAno}-12-31`;
      q = q.gte('data_vencimento', startDate).lte('data_vencimento', endDate);
    }

    // Filtro por mês (se anos estiverem selecionados)
    if (filterMeses.length > 0 && filterAnos.length > 0) {
      // Para múltiplos meses, usar OR filter
      const mesConditions = filterMeses.map(mes => {
        const mesStr = mes.toString().padStart(2, '0');
        return `data_vencimento.like.%-${mesStr}-%`;
      });
      // Infelizmente Supabase não suporta OR em meses facilmente, vamos filtrar no frontend
    }

    return q;
  };

  // Query LEVE para opções de filtro (empresas, contas, portadores)
  // Usa RPC que faz DISTINCT no banco - muito mais eficiente que carregar todos registros
  const { data: filterOptions, isLoading: isLoadingFilters } = useQuery({
    queryKey: ['contas-receber-filter-options', filterAnosKey],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_contas_receber_filter_options', {
        p_anos: filterAnos.length > 0 ? filterAnos : null
      });
      
      if (error) {
        console.error('Erro ao carregar opções de filtro:', error);
        return { empresas: [], contas: [], portadores: [] };
      }
      
      return data as { 
        empresas: { id: number; nome: string }[]; 
        contas: string[]; 
        portadores: string[] 
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
  });

  // Query para TABELA - paginação no backend
  const { data: contasTable, isLoading: isLoadingTable, refetch } = useQuery({
    queryKey: ['contas-receber-table', searchCliente, filterStatus, filterEmpresasKey, filterAnosKey, filterMesesKey, filterConta, filterPortador, filterDiaVencimento, filterDiaRecebimento, filterDiaEmissao, sortColumn, sortDirection, currentPage, pageSize],
    queryFn: async () => {
      // Query para dados paginados
      let query = supabase
        .from('contas_receber' as any)
        .select('*');

      if (searchCliente) {
        query = query.ilike('cliente_nome', `%${searchCliente}%`);
      }

      // Status em lowercase no banco
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus.toLowerCase());
      }

      query = buildBaseFilters(query);

      // Ordenação no backend
      const ascending = sortDirection === 'asc';
      query = query.order(sortColumn, { ascending });

      // Paginação no backend
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error } = await query;
      if (error) throw error;

      // Query para totais via RPC (sem limite de linhas)
      const { data: totaisRpc, error: totaisError } = await supabase.rpc(
        'get_contas_receber_totais_filtrados' as any,
        {
          p_empresas: filterEmpresas.length > 0 ? filterEmpresas : null,
          p_status: filterStatus !== 'all' ? filterStatus.toLowerCase() : null,
          p_cliente: searchCliente || null,
          p_conta: filterConta !== 'all' ? filterConta : null,
          p_portador: filterPortador !== 'all' ? filterPortador : null,
          p_anos: filterAnos.length > 0 ? filterAnos : null,
          p_meses: filterMeses.length > 0 ? filterMeses : null,
          p_dia_vencimento: filterDiaVencimento || null,
          p_dia_recebimento: filterDiaRecebimento || null,
          p_dia_emissao: filterDiaEmissao || null,
        }
      );
      
      let totais = { valorOriginal: 0, valorAberto: 0, valorRecebido: 0, totalRegistros: 0 };
      if (!totaisError && totaisRpc) {
        const t = totaisRpc as any;
        totais = {
          valorOriginal: t.valor_original || 0,
          valorAberto: t.valor_aberto || 0,
          valorRecebido: t.valor_recebido || 0,
          totalRegistros: t.total_registros || 0,
        };
      }

      return { data: data as unknown as ContaReceber[], totais };
    }
  });

  const isLoading = isLoadingFilters || isLoadingTable;

  // Dados paginados da tabela
  const sortedAndPaginatedData = useMemo(() => {
    if (!contasTable) return { data: [], totalPages: 0, totalItems: 0, totais: { valorOriginal: 0, valorAberto: 0, valorRecebido: 0, totalRegistros: 0 } };
    
    const totalItems = contasTable.totais.totalRegistros;
    const totalPages = Math.ceil(totalItems / pageSize);
    const totais = contasTable.totais;
    
    return { data: contasTable.data, totalPages, totalItems, totais };
  }, [contasTable, pageSize]);

  // Empresas únicas para filtro (via RPC leve)
  const empresas = useMemo(() => {
    return filterOptions?.empresas || [];
  }, [filterOptions]);

  // Contas únicas para filtro (via RPC leve)
  const contasUnicas = useMemo(() => {
    return filterOptions?.contas || [];
  }, [filterOptions]);

  // Portadores únicos para filtro (via RPC leve)
  const portadoresUnicos = useMemo(() => {
    return filterOptions?.portadores || [];
  }, [filterOptions]);

  // Ordenação clicável
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Exportar para Excel - usa dados da página atual ou faz export completo
  const handleExport = async () => {
    const tableData = sortedAndPaginatedData.data;
    
    if (!tableData || tableData.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    // Se tem poucos registros, exportar diretamente
    if (sortedAndPaginatedData.totalItems <= pageSize) {
      const dataToExport = tableData.map(c => ({
        empresa: c.empresa_nome,
        documento: `${c.numero_documento}/${c.parcela}`,
        cliente: c.cliente_nome,
        vendedor: c.vendedor_nome,
        emissao: formatLocalDate(c.data_emissao),
        vencimento: formatLocalDate(c.data_vencimento),
        valor_original: c.valor_original,
        valor_aberto: c.valor_aberto,
        valor_recebido: c.valor_recebido,
        status: c.status,
        portador: c.portador,
        conta: c.conta
      }));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'BiMaster';
      const worksheet = workbook.addWorksheet('Contas a Receber');
      worksheet.columns = [
        { header: 'Empresa', key: 'empresa', width: 20 },
        { header: 'Documento', key: 'documento', width: 15 },
        { header: 'Cliente', key: 'cliente', width: 30 },
        { header: 'Vendedor', key: 'vendedor', width: 25 },
        { header: 'Emissão', key: 'emissao', width: 12 },
        { header: 'Vencimento', key: 'vencimento', width: 12 },
        { header: 'Valor Original', key: 'valor_original', width: 15 },
        { header: 'Valor Aberto', key: 'valor_aberto', width: 15 },
        { header: 'Valor Recebido', key: 'valor_recebido', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Portador', key: 'portador', width: 20 },
        { header: 'Conta', key: 'conta', width: 15 },
      ];
      dataToExport.forEach(row => worksheet.addRow(row));
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `contas-receber-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success("Exportação concluída!");
      return;
    }

    // Para grandes volumes, exportar em batches
    toast.info("Exportando dados... isso pode levar alguns segundos.");
    
    try {
      const PAGE_SIZE = 5000;
      let allData: ContaReceber[] = [];
      let from = 0;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from('contas_receber' as any)
          .select('*');
        
        if (searchCliente) {
          query = query.ilike('cliente_nome', `%${searchCliente}%`);
        }
        if (filterStatus !== 'all') {
          query = query.eq('status', filterStatus.toLowerCase());
        }
        query = buildBaseFilters(query);
        query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
        query = query.range(from, from + PAGE_SIZE - 1);
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data as unknown as ContaReceber[]];
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      
      const dataToExport = allData.map(c => ({
        empresa: c.empresa_nome,
        documento: `${c.numero_documento}/${c.parcela}`,
        cliente: c.cliente_nome,
        vendedor: c.vendedor_nome,
        emissao: formatLocalDate(c.data_emissao),
        vencimento: formatLocalDate(c.data_vencimento),
        valor_original: c.valor_original,
        valor_aberto: c.valor_aberto,
        valor_recebido: c.valor_recebido,
        status: c.status,
        portador: c.portador,
        conta: c.conta
      }));

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'BiMaster';
      const worksheet = workbook.addWorksheet('Contas a Receber');
      worksheet.columns = [
        { header: 'Empresa', key: 'empresa', width: 20 },
        { header: 'Documento', key: 'documento', width: 15 },
        { header: 'Cliente', key: 'cliente', width: 30 },
        { header: 'Vendedor', key: 'vendedor', width: 25 },
        { header: 'Emissão', key: 'emissao', width: 12 },
        { header: 'Vencimento', key: 'vencimento', width: 12 },
        { header: 'Valor Original', key: 'valor_original', width: 15 },
        { header: 'Valor Aberto', key: 'valor_aberto', width: 15 },
        { header: 'Valor Recebido', key: 'valor_recebido', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Portador', key: 'portador', width: 20 },
        { header: 'Conta', key: 'conta', width: 15 },
      ];
      dataToExport.forEach(row => worksheet.addRow(row));
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `contas-receber-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success(`Exportação concluída! ${allData.length.toLocaleString()} registros.`);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error("Erro ao exportar dados");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      recebido: { variant: "default", icon: CheckCircle },
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

  // Componente de Filtros
  const FiltersSection = () => (
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-9">
          <div>
            <label className="text-sm font-medium mb-2 block">Ano</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>
                    {filterAnos.length === 0 
                      ? "Todos" 
                      : filterAnos.length === 1 
                        ? filterAnos[0].toString()
                        : `${filterAnos.length} anos`}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[180px] p-0 z-50 bg-popover" align="start">
                <div className="p-2 border-b">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => { setFilterAnos([]); setFilterMeses([]); setCurrentPage(1); }}
                  >
                    <CheckCircle className={`mr-2 h-4 w-4 ${filterAnos.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                    Todos os anos
                  </Button>
                </div>
                <div className="max-h-[200px] overflow-auto p-2 space-y-1">
                  {[2024, 2025, 2026, 2027].map(ano => (
                    <div key={ano} className="flex items-center space-x-2 p-1 hover:bg-muted rounded">
                      <Checkbox
                        id={`receber-ano-${ano}`}
                        checked={filterAnos.includes(ano)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilterAnos([...filterAnos, ano]);
                          } else {
                            setFilterAnos(filterAnos.filter(a => a !== ano));
                          }
                          setCurrentPage(1);
                        }}
                      />
                      <label htmlFor={`receber-ano-${ano}`} className="text-sm cursor-pointer flex-1">
                        {ano}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Mês</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between" disabled={filterAnos.length === 0}>
                  <span>
                    {filterMeses.length === 0 
                      ? "Todos" 
                      : filterMeses.length === 1 
                        ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][filterMeses[0] - 1]
                        : `${filterMeses.length} meses`}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[180px] p-0 z-50 bg-popover" align="start">
                <div className="p-2 border-b">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => { setFilterMeses([]); setCurrentPage(1); }}
                  >
                    <CheckCircle className={`mr-2 h-4 w-4 ${filterMeses.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                    Todos os meses
                  </Button>
                </div>
                <div className="max-h-[250px] overflow-auto p-2 space-y-1">
                  {[
                    { value: 1, label: 'Janeiro' },
                    { value: 2, label: 'Fevereiro' },
                    { value: 3, label: 'Março' },
                    { value: 4, label: 'Abril' },
                    { value: 5, label: 'Maio' },
                    { value: 6, label: 'Junho' },
                    { value: 7, label: 'Julho' },
                    { value: 8, label: 'Agosto' },
                    { value: 9, label: 'Setembro' },
                    { value: 10, label: 'Outubro' },
                    { value: 11, label: 'Novembro' },
                    { value: 12, label: 'Dezembro' },
                  ].map(mes => (
                    <div key={mes.value} className="flex items-center space-x-2 p-1 hover:bg-muted rounded">
                      <Checkbox
                        id={`receber-mes-${mes.value}`}
                        checked={filterMeses.includes(mes.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilterMeses([...filterMeses, mes.value]);
                          } else {
                            setFilterMeses(filterMeses.filter(m => m !== mes.value));
                          }
                          setCurrentPage(1);
                        }}
                      />
                      <label htmlFor={`receber-mes-${mes.value}`} className="text-sm cursor-pointer flex-1">
                        {mes.label}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Empresa</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {filterEmpresas.length === 0 
                      ? "Todas" 
                      : filterEmpresas.length === 1 
                        ? empresas.find(e => e.id === filterEmpresas[0])?.nome || "1 empresa"
                        : `${filterEmpresas.length} empresas`}
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                <div className="max-h-[200px] overflow-auto p-2 space-y-1">
                  {empresas.map(emp => (
                    <div key={emp.id} className="flex items-center space-x-2 p-1 hover:bg-muted rounded">
                      <Checkbox
                        id={`receber-emp-${emp.id}`}
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
                      <label htmlFor={`receber-emp-${emp.id}`} className="text-sm cursor-pointer flex-1">
                        {emp.nome}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={filterStatus} onValueChange={(val) => { setFilterStatus(val); setCurrentPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Conta</label>
            <Select value={filterConta} onValueChange={(val) => { setFilterConta(val); setCurrentPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {contasUnicas.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Portador</label>
            <Select value={filterPortador} onValueChange={(val) => { setFilterPortador(val); setCurrentPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {portadoresUnicos.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Data Emissão</label>
            <Input 
              type="date" 
              value={filterDiaEmissao} 
              onChange={(e) => { setFilterDiaEmissao(e.target.value); setCurrentPage(1); }}
              className="h-10"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Data Vencimento</label>
            <Input 
              type="date" 
              value={filterDiaVencimento} 
              onChange={(e) => { setFilterDiaVencimento(e.target.value); setCurrentPage(1); }}
              className="h-10"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Data Recebimento</label>
            <Input 
              type="date" 
              value={filterDiaRecebimento} 
              onChange={(e) => { setFilterDiaRecebimento(e.target.value); setCurrentPage(1); }}
              className="h-10"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Cliente</label>
            <Input
              placeholder="Buscar cliente..."
              value={searchCliente}
              onChange={(e) => { setSearchCliente(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>

        {/* Botão Limpar Filtros */}
        <div className="flex justify-end mt-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setFilterAnos([new Date().getFullYear()]);
              setFilterMeses([]);
              setFilterEmpresas([]);
              setFilterConta('all');
              setFilterPortador('all');
              setFilterDiaVencimento('');
              setFilterDiaRecebimento('');
              setFilterDiaEmissao('');
              setSearchCliente('');
              setFilterStatus('all');
              setCurrentPage(1);
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Limpar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Receipt className="h-8 w-8" />
              Contas a Receber
            </h1>
            <p className="text-muted-foreground">Gestão de recebimentos e clientes</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/financeiro">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Módulo Financeiro
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowImportDialog(true)} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Importar CSV
            </Button>
            {isAdmin && (
              <Button asChild variant="default" className="gap-2">
                <Link to="/dashboard/financeiro/contas-a-receber/sync">
                  <RefreshCw className="h-4 w-4" />
                  Sincronizar ERP
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="gap-2">
              <Link to="/dashboard/financeiro/contas-a-receber/auditoria">
                <AlertTriangle className="h-4 w-4" />
                Auditoria IA
              </Link>
            </Button>
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
          </div>
        </div>

        {/* Import Dialog */}
        <ImportarContasReceberCSV 
          open={showImportDialog} 
          onOpenChange={setShowImportDialog}
          onSuccess={() => {
            refetch();
            setShowImportDialog(false);
          }}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="calendario" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendário
            </TabsTrigger>
            <TabsTrigger value="tabela" className="flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              Tabela
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <FiltersSection />
            <DashboardContasReceberAggregated 
              filterEmpresas={filterEmpresas}
              filterAnos={filterAnos}
              filterMeses={filterMeses}
              filterConta={filterConta}
              filterPortador={filterPortador}
              filterDiaVencimento={filterDiaVencimento}
              filterDiaRecebimento={filterDiaRecebimento}
            />
          </TabsContent>

          {/* Calendário Tab */}
          <TabsContent value="calendario" className="space-y-6">
            <FiltersSection />
            <CalendarioRecebimentosAggregated 
              filterEmpresas={filterEmpresas}
              filterAnos={filterAnos}
              filterConta={filterConta}
              filterPortador={filterPortador}
              filterDiaVencimento={filterDiaVencimento}
            />
          </TabsContent>

          {/* Tabela Tab */}
          <TabsContent value="tabela" className="space-y-6">
            <FiltersSection />
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Contas a Receber</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {sortedAndPaginatedData.totalItems.toLocaleString()} registros
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('empresa_nome')}>
                          <div className="flex items-center">Empresa <SortIcon column="empresa_nome" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('numero_documento')}>
                          <div className="flex items-center">Documento <SortIcon column="numero_documento" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('cliente_nome')}>
                          <div className="flex items-center">Cliente <SortIcon column="cliente_nome" /></div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('vendedor_nome')}>
                          <div className="flex items-center">Vendedor <SortIcon column="vendedor_nome" /></div>
                        </TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('data_vencimento')}>
                          <div className="flex items-center">Vencimento <SortIcon column="data_vencimento" /></div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('valor_original')}>
                          <div className="flex items-center justify-end">Valor Original <SortIcon column="valor_original" /></div>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => handleSort('valor_aberto')}>
                          <div className="flex items-center justify-end">Valor Aberto <SortIcon column="valor_aberto" /></div>
                        </TableHead>
                        <TableHead className="text-right">Valor Recebido</TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('status')}>
                          <div className="flex items-center">Status <SortIcon column="status" /></div>
                        </TableHead>
                        <TableHead>Portador</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingTable ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : sortedAndPaginatedData.data && sortedAndPaginatedData.data.length > 0 ? (
                        sortedAndPaginatedData.data.map((conta) => (
                          <TableRow key={conta.id} className="cursor-pointer hover:bg-muted/40" onClick={() => { setSelectedCR(conta); setDetailDrawerOpen(true); }}>
                            <TableCell className="font-medium">{conta.empresa_nome}</TableCell>
                            <TableCell>{conta.numero_documento}/{conta.parcela}</TableCell>
                            <TableCell>{conta.cliente_nome}</TableCell>
                            <TableCell>{conta.vendedor_nome}</TableCell>
                            <TableCell>
                              {formatLocalDate(conta.data_emissao)}
                            </TableCell>
                            <TableCell>
                              {formatLocalDate(conta.data_vencimento)}
                            </TableCell>
                            <TableCell className="text-right">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor_original)}
                            </TableCell>
                            <TableCell className="text-right">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor_aberto)}
                            </TableCell>
                            <TableCell className="text-right">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor_recebido)}
                            </TableCell>
                            <TableCell>{getStatusBadge(conta.status)}</TableCell>
                            <TableCell>{conta.portador}</TableCell>
                            <TableCell onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedCR(conta); setDetailDrawerOpen(true); }}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                            Nenhuma conta encontrada
                          </TableCell>
                        </TableRow>
                      )}
                      {/* Linha de Totais */}
                      {sortedAndPaginatedData.data && sortedAndPaginatedData.data.length > 0 && (
                        <TableRow className="bg-muted/50 font-semibold border-t-2">
                          <TableCell colSpan={6} className="text-right">
                            Subtotal ({sortedAndPaginatedData.totalItems.toLocaleString()} títulos):
                          </TableCell>
                          <TableCell className="text-right">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sortedAndPaginatedData.totais.valorOriginal)}
                          </TableCell>
                          <TableCell className="text-right">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sortedAndPaginatedData.totais.valorAberto)}
                          </TableCell>
                          <TableCell className="text-right">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sortedAndPaginatedData.totais.valorRecebido)}
                          </TableCell>
                          <TableCell colSpan={2}></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Paginação Melhorada */}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      Mostrando {Math.min((currentPage - 1) * pageSize + 1, sortedAndPaginatedData.totalItems)} - {Math.min(currentPage * pageSize, sortedAndPaginatedData.totalItems)} de {sortedAndPaginatedData.totalItems.toLocaleString()} registros
                    </p>
                    <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
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
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Página {currentPage} de {sortedAndPaginatedData.totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(sortedAndPaginatedData.totalPages, p + 1))}
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ===== DETAIL DRAWER ===== */}
      <Drawer open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <div className="overflow-y-auto px-4 pb-6 md:px-6">
            <DrawerHeader className="px-0">
              <DrawerTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Detalhe — Conta a Receber
              </DrawerTitle>
              <DrawerDescription>
                {selectedCR?.numero_documento}/{selectedCR?.parcela} — {selectedCR?.cliente_nome}
              </DrawerDescription>
            </DrawerHeader>

            {selectedCR && (
              <CRDetailContent conta={selectedCR} />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </DashboardLayout>
  );
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function CRDetailContent({ conta }: { conta: ContaReceber }) {
  // Fetch full record with all fields
  const { data: full } = useQuery({
    queryKey: ["cr-detail-full", conta.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_receber" as any).select("*").eq("id", conta.id).single();
      if (error) throw error;
      return data as any;
    },
  });

  const r = full || conta;

  return (
    <div className="space-y-6">
      {/* Dados Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DetailField label="Empresa" value={r.empresa_nome} />
        <DetailField label="Documento" value={`${r.numero_documento}/${r.parcela}`} />
        <DetailField label="Cliente" value={r.cliente_nome} />
        <DetailField label="Cód. Cliente" value={r.cliente_codigo} />
        <DetailField label="Vendedor" value={r.vendedor_nome} />
        <DetailField label="Status" value={r.status} />
        <DetailField label="Emissão" value={formatLocalDate(r.data_emissao)} />
        <DetailField label="Vencimento" value={formatLocalDate(r.data_vencimento)} />
        <DetailField label="Recebimento" value={r.data_recebimento ? formatLocalDate(r.data_recebimento) : null} />
        <DetailField label="Portador" value={r.portador} />
        <DetailField label="Conta" value={r.conta} />
        <DetailField label="Tipo Documento" value={r.tipo_documento} />
      </div>

      <Separator />

      {/* Valores */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <DetailField label="Valor Original" value={BRL.format(r.valor_original || 0)} highlight />
        <DetailField label="Valor Aberto" value={BRL.format(r.valor_aberto || 0)} highlight />
        <DetailField label="Valor Recebido" value={BRL.format(r.valor_recebido || 0)} highlight />
        <DetailField label="Juros" value={BRL.format(r.valor_juros || 0)} />
        <DetailField label="Desconto" value={BRL.format(r.valor_desconto || 0)} />
        <DetailField label="Categoria" value={r.categoria_nome} />
        <DetailField label="Observações" value={r.observacoes} />
        <DetailField label="Descrição" value={r.descricao} />
        <DetailField label="NSU" value={r.nsu} />
      </div>

      {/* Boleto */}
      {(r.boleto_gerado || r.boleto_numero) && (
        <>
          <Separator />
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
              <span className="text-sm font-semibold flex items-center gap-2"><Landmark className="h-4 w-4" /> Dados do Boleto</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                <DetailField label="Boleto Gerado" value={r.boleto_gerado ? "Sim" : "Não"} />
                <DetailField label="Número" value={r.boleto_numero} />
                <DetailField label="Nº Bancário" value={r.boleto_numero_bancario} />
                <DetailField label="% Juros" value={r.boleto_per_juros != null ? `${r.boleto_per_juros}%` : null} />
                <DetailField label="% Multa" value={r.boleto_per_multa != null ? `${r.boleto_per_multa}%` : null} />
                <DetailField label="Data Emissão" value={r.boleto_data_emissao ? formatLocalDate(r.boleto_data_emissao) : null} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}

      {/* Impostos Retidos */}
      <Collapsible>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
          <span className="text-sm font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Impostos Retidos</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <DetailField label="PIS" value={BRL.format(r.valor_pis || 0)} />
            <DetailField label="Reter PIS" value={r.retem_pis ? "Sim" : "Não"} />
            <DetailField label="COFINS" value={BRL.format(r.valor_cofins || 0)} />
            <DetailField label="Reter COFINS" value={r.retem_cofins ? "Sim" : "Não"} />
            <DetailField label="CSLL" value={BRL.format(r.valor_csll || 0)} />
            <DetailField label="Reter CSLL" value={r.retem_csll ? "Sim" : "Não"} />
            <DetailField label="IR" value={BRL.format(r.valor_ir || 0)} />
            <DetailField label="Reter IR" value={r.retem_ir ? "Sim" : "Não"} />
            <DetailField label="ISS" value={BRL.format(r.valor_iss || 0)} />
            <DetailField label="Reter ISS" value={r.retem_iss ? "Sim" : "Não"} />
            <DetailField label="INSS" value={BRL.format(r.valor_inss || 0)} />
            <DetailField label="Reter INSS" value={r.retem_inss ? "Sim" : "Não"} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Rateios */}
      {(r.rateio_categorias || r.rateio_departamentos) && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
            <span className="text-sm font-semibold flex items-center gap-2"><FileBarChart className="h-4 w-4" /> Rateios</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 pt-2">
              {r.rateio_categorias && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Categorias</p>
                  <pre className="bg-muted/50 p-2 rounded text-xs overflow-auto max-h-40">{JSON.stringify(r.rateio_categorias, null, 2)}</pre>
                </div>
              )}
              {r.rateio_departamentos && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Departamentos</p>
                  <pre className="bg-muted/50 p-2 rounded text-xs overflow-auto max-h-40">{JSON.stringify(r.rateio_departamentos, null, 2)}</pre>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Comercial */}
      {(r.n_cod_os || r.n_cod_pedido || r.c_numero_contrato || r.c_pedido_cliente) && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
            <span className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Dados Comerciais</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              <DetailField label="Cód. OS" value={r.n_cod_os ? String(r.n_cod_os) : null} />
              <DetailField label="Cód. Pedido" value={r.n_cod_pedido ? String(r.n_cod_pedido) : null} />
              <DetailField label="Nº Contrato" value={r.c_numero_contrato} />
              <DetailField label="Pedido Cliente" value={r.c_pedido_cliente} />
              <DetailField label="Tabela Preço" value={r.tabela_preco} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Auditoria */}
      {(r.data_inc || r.user_inc) && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
            <span className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Auditoria</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <DetailField label="Incluído em" value={r.data_inc} />
              <DetailField label="Hora Inclusão" value={r.hora_inc} />
              <DetailField label="Usuário Inc." value={r.user_inc} />
              <DetailField label="Alterado em" value={r.data_alt} />
              <DetailField label="Hora Alteração" value={r.hora_alt} />
              <DetailField label="Usuário Alt." value={r.user_alt} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function DetailField({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium text-sm ${highlight ? "font-semibold" : ""}`}>{value || "—"}</p>
    </div>
  );
}
