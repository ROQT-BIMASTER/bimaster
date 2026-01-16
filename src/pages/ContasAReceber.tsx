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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Download, Receipt, AlertCircle, CheckCircle, Clock, ArrowLeft, Building2, ChevronsUpDown, 
  LayoutDashboard, CalendarDays, TableIcon, AlertTriangle, RefreshCw, Upload,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from 'xlsx';
import { toast } from "sonner";
import { DashboardContasReceberAggregated } from "@/components/financeiro/DashboardContasReceberAggregated";
import { CalendarioRecebimentosAggregated } from "@/components/financeiro/CalendarioRecebimentosAggregated";
import ImportarContasReceberCSV from "@/components/financeiro/ImportarContasReceberCSV";

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
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchCliente, setSearchCliente] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmpresas, setFilterEmpresas] = useState<number[]>([]);
  const [filterAnos, setFilterAnos] = useState<number[]>([new Date().getFullYear()]);
  const [filterMeses, setFilterMeses] = useState<number[]>([]);
  const [filterConta, setFilterConta] = useState<string>("all");
  const [filterPortador, setFilterPortador] = useState<string>("all");
  const [filterDiaVencimento, setFilterDiaVencimento] = useState<string>("");
  const [filterDiaRecebimento, setFilterDiaRecebimento] = useState<string>("");
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Ordenação
  const [sortColumn, setSortColumn] = useState<SortColumn>('data_vencimento');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Converte filterEmpresas para string para o queryKey detectar mudanças corretamente
  const filterEmpresasKey = filterEmpresas.length > 0 ? filterEmpresas.sort().join(',') : 'all';
  const filterAnosKey = filterAnos.length > 0 ? filterAnos.sort().join(',') : 'all';
  const filterMesesKey = filterMeses.length > 0 ? filterMeses.sort().join(',') : 'all';

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

  // Query para DASHBOARD - busca dados com limite para performance
  const { data: contasDashboard, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ['contas-receber-dashboard', filterEmpresasKey, filterAnosKey, filterMesesKey, filterConta, filterPortador, filterDiaVencimento, filterDiaRecebimento],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const MAX_RECORDS = 800000; // Limite máximo para evitar timeout
      let allData: ContaReceber[] = [];
      let from = 0;
      let hasMore = true;
      
      while (hasMore && allData.length < MAX_RECORDS) {
        let query = supabase
          .from('contas_receber' as any)
          .select('*');
        
        query = buildBaseFilters(query);
        query = query.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
        
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
      
      return allData;
    }
  });

  // Query para CALENDÁRIO - busca ano inteiro (ignora filtro de mês)
  const { data: contasCalendario, isLoading: isLoadingCalendario } = useQuery({
    queryKey: ['contas-receber-calendario', filterEmpresasKey, filterAnosKey, filterConta, filterPortador],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const MAX_RECORDS = 800000; // Limite máximo para evitar timeout
      let allData: ContaReceber[] = [];
      let from = 0;
      let hasMore = true;
      
      while (hasMore && allData.length < MAX_RECORDS) {
        let query = supabase
          .from('contas_receber' as any)
          .select('*');
        
        // Filtros base SEM mês
        if (filterEmpresas.length > 0) {
          query = query.in('empresa_id', filterEmpresas);
        }
        if (filterConta !== 'all') {
          query = query.eq('conta', filterConta);
        }
        if (filterPortador !== 'all') {
          query = query.eq('portador', filterPortador);
        }
        
        // Ano inteiro (ou últimos 3 anos se vazio)
        if (filterAnos.length === 0) {
          const anoAtual = new Date().getFullYear();
          query = query.gte('data_vencimento', `${anoAtual - 2}-01-01`).lte('data_vencimento', `${anoAtual + 1}-12-31`);
        } else if (filterAnos.length === 1) {
          query = query.gte('data_vencimento', `${filterAnos[0]}-01-01`).lte('data_vencimento', `${filterAnos[0]}-12-31`);
        } else {
          const minAno = Math.min(...filterAnos);
          const maxAno = Math.max(...filterAnos);
          query = query.gte('data_vencimento', `${minAno}-01-01`).lte('data_vencimento', `${maxAno}-12-31`);
        }
        
        query = query.order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
        
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
      
      return allData;
    }
  });

  // Query para TABELA - paginação no backend
  const { data: contasTable, isLoading: isLoadingTable, refetch } = useQuery({
    queryKey: ['contas-receber-table', searchCliente, filterStatus, filterEmpresasKey, filterAnosKey, filterMesesKey, filterConta, filterPortador, filterDiaVencimento, filterDiaRecebimento, sortColumn, sortDirection, currentPage, pageSize],
    queryFn: async () => {
      let query = supabase
        .from('contas_receber' as any)
        .select('*', { count: 'exact' });

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

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as unknown as ContaReceber[], count: count || 0 };
    }
  });

  // Dados base para compatibilidade (usado em KPIs, exports, etc.)
  const contasBase = contasDashboard;

  // Aplica filtros da aba (Status + Busca) também nos dados usados por Dashboard/Calendário
  const contas = useMemo(() => {
    let list = contasBase || [];

    if (filterStatus !== 'all') {
      const status = filterStatus.toLowerCase();
      list = list.filter(c => (c.status || '').toLowerCase() === status);
    }

    const search = searchCliente.trim().toLowerCase();
    if (search) {
      list = list.filter(c => (c.cliente_nome || '').toLowerCase().includes(search));
    }

    return list;
  }, [contasBase, filterStatus, searchCliente]);

  const isLoading = isLoadingDashboard || isLoadingTable;

  // Dados paginados da tabela
  const sortedAndPaginatedData = useMemo(() => {
    if (!contasTable) return { data: [], totalPages: 0, totalItems: 0 };
    
    const totalItems = contasTable.count;
    const totalPages = Math.ceil(totalItems / pageSize);
    
    return { data: contasTable.data, totalPages, totalItems };
  }, [contasTable, pageSize]);

  // Empresas únicas para filtro (do dashboard para ter mais dados)
  const empresas = useMemo(() => {
    const list = contasDashboard || [];
    const map = new Map<number, string>();
    list.forEach(c => {
      if (c.empresa_id && c.empresa_nome && !map.has(c.empresa_id)) {
        map.set(c.empresa_id, c.empresa_nome);
      }
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [contasDashboard]);

  // Extrair listas únicas de Conta e Portador
  const contasUnicas = useMemo(() => {
    const set = new Set<string>();
    (contasDashboard || []).forEach(c => { if (c.conta) set.add(c.conta); });
    return Array.from(set).sort();
  }, [contasDashboard]);

  const portadoresUnicos = useMemo(() => {
    const set = new Set<string>();
    (contasDashboard || []).forEach(c => { if (c.portador) set.add(c.portador); });
    return Array.from(set).sort();
  }, [contasDashboard]);

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

  // Exportar para Excel
  const handleExport = () => {
    if (!contas || contas.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    const dataToExport = contas.map(c => ({
      'Empresa': c.empresa_nome,
      'Documento': `${c.numero_documento}/${c.parcela}`,
      'Cliente': c.cliente_nome,
      'Vendedor': c.vendedor_nome,
      'Emissão': c.data_emissao ? format(new Date(c.data_emissao), 'dd/MM/yyyy', { locale: ptBR }) : '',
      'Vencimento': c.data_vencimento ? format(new Date(c.data_vencimento), 'dd/MM/yyyy', { locale: ptBR }) : '',
      'Valor Original': c.valor_original,
      'Valor Aberto': c.valor_aberto,
      'Valor Recebido': c.valor_recebido,
      'Status': c.status,
      'Portador': c.portador,
      'Conta': c.conta
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contas a Receber");
    XLSX.writeFile(wb, `contas-receber-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success("Exportação concluída!");
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
            <label className="text-sm font-medium mb-2 block">Dia Vencimento</label>
            <Input 
              type="date" 
              value={filterDiaVencimento} 
              onChange={(e) => { setFilterDiaVencimento(e.target.value); setCurrentPage(1); }}
              className="h-10"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Dia Recebimento</label>
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
                          <TableRow key={conta.id}>
                            <TableCell className="font-medium">{conta.empresa_nome}</TableCell>
                            <TableCell>{conta.numero_documento}/{conta.parcela}</TableCell>
                            <TableCell>{conta.cliente_nome}</TableCell>
                            <TableCell>{conta.vendedor_nome}</TableCell>
                            <TableCell>
                              {conta.data_emissao ? format(new Date(conta.data_emissao), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                            </TableCell>
                            <TableCell>
                              {conta.data_vencimento ? format(new Date(conta.data_vencimento), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
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
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                            Nenhuma conta encontrada
                          </TableCell>
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
    </DashboardLayout>
  );
}
