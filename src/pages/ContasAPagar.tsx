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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Receipt, AlertCircle, CheckCircle, Clock, TrendingUp, Plus, FileText, Eye, BookOpen, ArrowLeft, Brain, Bot } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from 'xlsx';
import { toast } from "sonner";
import { SolicitarOrcamentoDialog } from "@/components/trade/SolicitarOrcamentoDialog";
import { AprovarOrcamentoDialog } from "@/components/trade/AprovarOrcamentoDialog";
import { ClassificarContasPagarDialog } from "@/components/configuracoes/ClassificarContasPagarDialog";
import { useUserRole } from "@/hooks/useUserRole";

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
}

export default function ContasAPagar() {
  const { userType, isAdmin } = useUserRole();
  
  const [searchFornecedor, setSearchFornecedor] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmpresa, setFilterEmpresa] = useState<string>("all");
  const [filterAno, setFilterAno] = useState<string>(new Date().getFullYear().toString());
  const [filterMes, setFilterMes] = useState<string>("all");
  const [solicitarOrcamentoOpen, setSolicitarOrcamentoOpen] = useState(false);
  const [aprovarOrcamentoOpen, setAprovarOrcamentoOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<any>(null);
  const [budgetFilter, setBudgetFilter] = useState<string>("all");
  const [classificarIAOpen, setClassificarIAOpen] = useState(false);
  const [filterAnoClassificacao, setFilterAnoClassificacao] = useState<string>(new Date().getFullYear().toString());
  const [filterMesClassificacao, setFilterMesClassificacao] = useState<string>("all");

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

  // Query contas a pagar
  const { data: contas, isLoading, refetch: refetchContas } = useQuery({
    queryKey: ['contas-pagar', searchFornecedor, filterStatus, filterEmpresa, filterAno, filterMes],
    queryFn: async () => {
      let query = supabase
        .from('contas_pagar')
        .select('*')
        .order('data_vencimento', { ascending: false });

      if (searchFornecedor) {
        query = query.ilike('fornecedor_nome', `%${searchFornecedor}%`);
      }

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      if (filterEmpresa !== 'all') {
        query = query.eq('empresa_id', parseInt(filterEmpresa));
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
      return data as ContaPagar[];
    }
  });

  // Calcular KPIs
  const kpis = {
    totalAPagar: contas?.filter(c => ['pendente', 'vencido', 'parcial'].includes(c.status))
      .reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0,
    vencendoHoje: contas?.filter(c => c.data_vencimento === format(new Date(), 'yyyy-MM-dd'))
      .reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0,
    vencidas: contas?.filter(c => c.status === 'vencido')
      .reduce((sum, c) => sum + (c.valor_aberto || 0), 0) || 0,
    pagasNoMes: contas?.filter(c => {
      if (!c.data_pagamento) return false;
      const pagamento = new Date(c.data_pagamento);
      const hoje = new Date();
      return pagamento.getMonth() === hoje.getMonth() && pagamento.getFullYear() === hoje.getFullYear();
    }).reduce((sum, c) => sum + (c.valor_pago || 0), 0) || 0
  };

  // Empresas únicas para filtro
  const empresas = Array.from(new Set(contas?.map(c => ({ id: c.empresa_id, nome: c.empresa_nome })) || []))
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

      // Filtrar por status de aprovação
      if (budgetFilter !== "all") {
        query = query.eq('approval_status', budgetFilter);
      }

      // Não-admins só veem seus próprios orçamentos
      if (userType !== 'admin') {
        query = query.eq('requested_by', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!userType,
  });

  // Contar orçamentos pendentes (só para admins)
  const pendingBudgetsCount = budgets?.filter(b => b.approval_status === 'pending').length || 0;

  // Exportar para Excel
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
      'Emissão': c.data_emissao ? format(new Date(c.data_emissao), 'dd/MM/yyyy', { locale: ptBR }) : '',
      'Vencimento': c.data_vencimento ? format(new Date(c.data_vencimento), 'dd/MM/yyyy', { locale: ptBR }) : '',
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

  // Função para atualizar departamento e plano de contas
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

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total a Pagar</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.totalAPagar)}
              </div>
              <p className="text-xs text-muted-foreground">Pendente + Vencido + Parcial</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencendo Hoje</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.vencendoHoje)}
              </div>
              <p className="text-xs text-muted-foreground">Vencimento hoje</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vencidas</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kpis.vencidas)}
              </div>
              <p className="text-xs text-muted-foreground">Contas vencidas</p>
            </CardContent>
          </Card>

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

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-6">
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
                <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {empresas.map(emp => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
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
                  onChange={(e) => setSearchFornecedor(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="contas" className="space-y-6">
          <TabsList>
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

          {/* Aba de Contas a Pagar */}
          <TabsContent value="contas" className="space-y-6">
            {/* Filtros */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-6">
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
                    <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {empresas.map(emp => (
                          <SelectItem key={emp.id} value={emp.id.toString()}>
                            {emp.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
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
                      onChange={(e) => setSearchFornecedor(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Contas */}
            <Card>
              <CardContent className="pt-6">
                {isLoading ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : contas && contas.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Fornecedor</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead className="text-right">Valor Original</TableHead>
                          <TableHead className="text-right">Valor Aberto</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contas.map((conta) => (
                          <TableRow key={conta.id}>
                            <TableCell className="font-medium">{conta.empresa_nome}</TableCell>
                            <TableCell>{conta.numero_documento}/{conta.parcela}</TableCell>
                            <TableCell>{conta.fornecedor_nome}</TableCell>
                            <TableCell>{conta.categoria_nome}</TableCell>
                            <TableCell>
                              {conta.data_vencimento ? format(new Date(conta.data_vencimento), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
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
                      <Brain className="h-5 w-5" />
                      Classificação Automática com IA
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Visualize e gerencie as classificações automáticas de departamento e plano de contas
                    </p>
                  </div>
                  <Button onClick={() => setClassificarIAOpen(true)} className="gap-2">
                    <Brain className="h-4 w-4" />
                    Classificar Todas
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filtros de Classificação */}
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Ano</label>
                    <Select value={filterAnoClassificacao} onValueChange={(value) => {
                      setFilterAnoClassificacao(value);
                      if (value === 'all') setFilterMesClassificacao('all');
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
                      value={filterMesClassificacao} 
                      onValueChange={setFilterMesClassificacao}
                      disabled={filterAnoClassificacao === 'all'}
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
                    <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {empresas.map(emp => (
                          <SelectItem key={emp.id} value={emp.id.toString()}>
                            {emp.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tabela de Contas Classificadas */}
                {isLoading ? (
                  <div className="text-center py-8">Carregando classificações...</div>
                ) : (() => {
                  // Filtrar contas por ano/mês de classificação
                  const contasFiltradas = contas?.filter(c => {
                    if (!c.data_vencimento) return false;
                    
                    const dataVencimento = new Date(c.data_vencimento);
                    const ano = dataVencimento.getFullYear().toString();
                    const mes = (dataVencimento.getMonth() + 1).toString();
                    
                    // Filtro de ano
                    if (filterAnoClassificacao !== 'all' && ano !== filterAnoClassificacao) {
                      return false;
                    }
                    
                    // Filtro de mês (só aplica se ano estiver selecionado)
                    if (filterMesClassificacao !== 'all' && filterAnoClassificacao !== 'all' && mes !== filterMesClassificacao) {
                      return false;
                    }
                    
                    return true;
                  });

                  const totalContas = contasFiltradas?.length || 0;
                  const classificadas = contasFiltradas?.filter(c => c.departamento_id && c.plano_contas_id).length || 0;
                  const pendentes = totalContas - classificadas;
                  const percentual = totalContas > 0 ? ((classificadas / totalContas) * 100).toFixed(1) : "0";

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

                      {/* Tabela */}
                      {contasFiltradas && contasFiltradas.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Fornecedor</TableHead>
                                <TableHead>Documento</TableHead>
                                <TableHead>Vencimento</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead>Departamento</TableHead>
                                <TableHead>Plano de Contas</TableHead>
                                <TableHead className="text-center">Confiança</TableHead>
                                <TableHead>Classificado Em</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {contasFiltradas.map((conta) => (
                                <TableRow key={conta.id}>
                                  <TableCell className="font-medium">
                                    {conta.fornecedor_nome || 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">
                                      {conta.numero_documento}/{conta.parcela}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {conta.data_vencimento 
                                      ? format(new Date(conta.data_vencimento), 'dd/MM/yyyy', { locale: ptBR })
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {new Intl.NumberFormat('pt-BR', {
                                      style: 'currency',
                                      currency: 'BRL'
                                    }).format(conta.valor_original || 0)}
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={conta.departamento_id || ""}
                                      onValueChange={(value) => 
                                        handleUpdateClassificacao(conta.id, value || null, conta.plano_contas_id)
                                      }
                                    >
                                      <SelectTrigger className="w-[200px] h-8 text-xs">
                                        <SelectValue placeholder="Selecione...">
                                          {conta.departamento_nome || "Selecione..."}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent className="bg-background z-[100]">
                                        {departamentos?.map((dept) => (
                                          <SelectItem key={dept.id} value={dept.id}>
                                            {dept.nome}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell>
                                    <Select
                                      value={conta.plano_contas_id || ""}
                                      onValueChange={(value) => 
                                        handleUpdateClassificacao(conta.id, conta.departamento_id, value || null)
                                      }
                                    >
                                      <SelectTrigger className="w-[280px] h-8 text-xs">
                                        <SelectValue placeholder="Selecione...">
                                          {conta.plano_contas_codigo && conta.plano_contas_nome 
                                            ? `${conta.plano_contas_codigo} - ${conta.plano_contas_nome}`
                                            : "Selecione..."}
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
                                    {conta.confianca_classificacao ? (
                                      <Badge 
                                        variant={
                                          conta.confianca_classificacao >= 0.8
                                            ? "default"
                                            : conta.confianca_classificacao >= 0.6
                                            ? "secondary"
                                            : "destructive"
                                        }
                                      >
                                        {(conta.confianca_classificacao * 100).toFixed(0)}%
                                      </Badge>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {conta.classificado_em ? (
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(conta.classificado_em), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {conta.departamento_id && conta.plano_contas_id ? (
                                      <Badge variant="default" className="gap-1">
                                        <CheckCircle className="h-3 w-3" />
                                        Completa
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="gap-1">
                                        <Clock className="h-3 w-3" />
                                        Pendente
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
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
            toast.success("Classificação concluída! Atualizando lista...");
          }}
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
