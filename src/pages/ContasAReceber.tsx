import { useState } from "react";
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
import { Download, Receipt, AlertCircle, CheckCircle, Clock, ArrowLeft, Building2, ChevronsUpDown, LayoutDashboard, CalendarDays, TableIcon, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from 'xlsx';
import { toast } from "sonner";
import { DashboardContasReceber } from "@/components/financeiro/DashboardContasReceber";
import { CalendarioRecebimentos } from "@/components/financeiro/CalendarioRecebimentos";

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

export default function ContasAReceber() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchCliente, setSearchCliente] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmpresas, setFilterEmpresas] = useState<number[]>([]);
  const [filterAno, setFilterAno] = useState<string>(new Date().getFullYear().toString());
  const [filterMes, setFilterMes] = useState<string>("all");

  // Query contas a receber
  const { data: contas, isLoading } = useQuery<ContaReceber[]>({
    queryKey: ['contas-receber', searchCliente, filterStatus, filterEmpresas, filterAno, filterMes],
    queryFn: async () => {
      let query = supabase
        .from('contas_receber' as any)
        .select('*')
        .order('data_vencimento', { ascending: false });

      if (searchCliente) {
        query = query.ilike('cliente_nome', `%${searchCliente}%`);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (filterEmpresas.length > 0) {
        query = query.in('empresa_id', filterEmpresas);
      }

      // Filtro por ano
      if (filterAno !== 'all') {
        const startDate = `${filterAno}-01-01`;
        const endDate = `${filterAno}-12-31`;
        query = query.gte('data_vencimento', startDate).lte('data_vencimento', endDate);
      }

      // Filtro por mês (se ano estiver selecionado)
      if (filterMes !== 'all' && filterAno !== 'all') {
        const mes = filterMes.padStart(2, '0');
        const startDate = `${filterAno}-${mes}-01`;
        const lastDay = new Date(parseInt(filterAno), parseInt(filterMes), 0).getDate();
        const endDate = `${filterAno}-${mes}-${lastDay}`;
        query = query.gte('data_vencimento', startDate).lte('data_vencimento', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ContaReceber[];
    }
  });

  // Empresas únicas para filtro
  const empresas = Array.from(new Set(contas?.map(c => ({ id: c.empresa_id, nome: c.empresa_nome })) || []))
    .reduce((acc, curr) => {
      if (!acc.find(e => e.id === curr.id)) acc.push(curr);
      return acc;
    }, [] as { id: number; nome: string }[]);

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
        <div className="grid gap-4 md:grid-cols-5">
          <div>
            <label className="text-sm font-medium mb-2 block">Ano</label>
            <Select value={filterAno} onValueChange={(value) => {
              setFilterAno(value);
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
              onValueChange={setFilterMes}
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
                    onClick={() => setFilterEmpresas([])}
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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
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
            <label className="text-sm font-medium mb-2 block">Cliente</label>
            <Input
              placeholder="Buscar cliente..."
              value={searchCliente}
              onChange={(e) => setSearchCliente(e.target.value)}
            />
          </div>
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
            <DashboardContasReceber contas={contas} isLoading={isLoading} />
          </TabsContent>

          {/* Calendário Tab */}
          <TabsContent value="calendario" className="space-y-6">
            <FiltersSection />
            <CalendarioRecebimentos contas={contas} isLoading={isLoading} />
          </TabsContent>

          {/* Tabela Tab */}
          <TabsContent value="tabela" className="space-y-6">
            <FiltersSection />
            
            <Card>
              <CardHeader>
                <CardTitle>Contas a Receber</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor Original</TableHead>
                        <TableHead className="text-right">Valor Aberto</TableHead>
                        <TableHead className="text-right">Valor Recebido</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Portador</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8">
                            Carregando...
                          </TableCell>
                        </TableRow>
                      ) : contas && contas.length > 0 ? (
                        contas.slice(0, 100).map((conta) => (
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
                {contas && contas.length > 100 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Exibindo 100 de {contas.length} registros. Use os filtros para refinar sua busca.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
