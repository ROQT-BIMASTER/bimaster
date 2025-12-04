import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertCircle, 
  ArrowLeft, 
  Phone, 
  Mail, 
  MessageCircle, 
  TrendingUp, 
  Handshake,
  Users,
  DollarSign,
  Clock,
  Building2,
  CheckCircle,
  ChevronsUpDown,
  LayoutDashboard,
  List,
  Target,
  RefreshCw,
  Download,
  Filter
} from "lucide-react";
import { InadimplenteDrawerPro } from "@/components/cobranca/InadimplenteDrawerPro";
import { CobrancaDashboard } from "@/components/cobranca/CobrancaDashboard";
import { FilaCobranca } from "@/components/cobranca/FilaCobranca";

interface ContaVencida {
  id: string;
  cliente_codigo: string;
  cliente_nome: string;
  empresa_id: number;
  empresa_nome: string;
  numero_documento: string;
  parcela: number;
  valor_aberto: number;
  valor_original: number;
  data_vencimento: string;
  dias_atraso: number;
  vendedor_nome: string;
}

interface ClienteAgrupado {
  cliente_codigo: string;
  cliente_nome: string;
  total_aberto: number;
  total_titulos: number;
  dias_medio_atraso: number;
  maior_atraso: number;
  contas: ContaVencida[];
  ultima_cobranca?: {
    tipo_acao: string;
    data_acao: string;
    data_retorno?: string;
    status: string;
  };
  score?: number;
  prioridade?: 'critical' | 'high' | 'medium' | 'low';
}

// Função para calcular score de risco
function calcularScore(cliente: ClienteAgrupado): { score: number; prioridade: 'critical' | 'high' | 'medium' | 'low' } {
  let score = 0;
  
  // Dias de atraso (peso 40%)
  if (cliente.maior_atraso >= 90) score += 40;
  else if (cliente.maior_atraso >= 60) score += 30;
  else if (cliente.maior_atraso >= 30) score += 20;
  else score += 10;

  // Valor em aberto (peso 30%)
  if (cliente.total_aberto >= 50000) score += 30;
  else if (cliente.total_aberto >= 20000) score += 22;
  else if (cliente.total_aberto >= 5000) score += 15;
  else score += 5;

  // Quantidade de títulos (peso 15%)
  if (cliente.total_titulos >= 5) score += 15;
  else if (cliente.total_titulos >= 3) score += 10;
  else score += 5;

  // Histórico (peso 15%)
  if (!cliente.ultima_cobranca) score += 10;
  else if (cliente.ultima_cobranca.status === 'acordo') score -= 10;
  else if (cliente.ultima_cobranca.status === 'sem_sucesso') score += 15;
  else score += 5;

  score = Math.max(0, Math.min(100, score));
  
  const prioridade = score >= 70 ? 'critical' : score >= 50 ? 'high' : score >= 30 ? 'medium' : 'low';
  
  return { score, prioridade };
}

export default function CobrancaInadimplentes() {
  const [searchCliente, setSearchCliente] = useState("");
  const [filterEmpresas, setFilterEmpresas] = useState<number[]>([]);
  const [filterDiasAtraso, setFilterDiasAtraso] = useState<string>("all");
  const [filterPrioridade, setFilterPrioridade] = useState<string>("all");
  const [selectedCliente, setSelectedCliente] = useState<ClienteAgrupado | null>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "lista" | "fila">("dashboard");

  // Query contas vencidas
  const { data: contasVencidas, isLoading, refetch } = useQuery({
    queryKey: ['contas-vencidas', filterEmpresas, filterDiasAtraso],
    queryFn: async () => {
      let query = supabase
        .from('contas_receber')
        .select('*')
        .eq('status', 'vencido')
        .gt('valor_aberto', 0)
        .order('dias_atraso', { ascending: false });

      if (filterEmpresas.length > 0) {
        query = query.in('empresa_id', filterEmpresas);
      }

      if (filterDiasAtraso !== 'all') {
        const diasMin = parseInt(filterDiasAtraso);
        query = query.gte('dias_atraso', diasMin);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ContaVencida[];
    }
  });

  // Query últimas cobranças por cliente
  const { data: ultimasCobrancas } = useQuery({
    queryKey: ['ultimas-cobrancas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas')
        .select('cliente_codigo, tipo_acao, data_acao, data_retorno, status')
        .order('data_acao', { ascending: false });
      
      if (error) throw error;
      
      const porCliente: Record<string, any> = {};
      data?.forEach(c => {
        if (!porCliente[c.cliente_codigo]) {
          porCliente[c.cliente_codigo] = c;
        }
      });
      return porCliente;
    }
  });

  // Query acordos ativos
  const { data: acordosAtivos } = useQuery({
    queryKey: ['acordos-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .eq('status', 'acordo')
        .not('valor_acordo', 'is', null);
      
      if (error) throw error;
      return data;
    }
  });

  // Query cobranças do mês para métricas
  const { data: cobrancasMes } = useQuery({
    queryKey: ['cobrancas-mes'],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('cobrancas')
        .select('*')
        .gte('data_acao', inicioMes.toISOString());
      
      if (error) throw error;
      return data;
    }
  });

  // Empresas únicas para filtro
  const empresas = useMemo(() => {
    if (!contasVencidas) return [];
    const seen = new Map<number, string>();
    contasVencidas.forEach(c => {
      if (c.empresa_id && c.empresa_nome && !seen.has(c.empresa_id)) {
        seen.set(c.empresa_id, c.empresa_nome);
      }
    });
    return Array.from(seen.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [contasVencidas]);

  // Agrupar contas por cliente com score
  const clientesAgrupados: ClienteAgrupado[] = useMemo(() => {
    if (!contasVencidas) return [];
    
    const agrupados = Object.values(
      contasVencidas.reduce((acc: Record<string, ClienteAgrupado>, conta) => {
        const key = conta.cliente_codigo;
        if (!acc[key]) {
          acc[key] = {
            cliente_codigo: conta.cliente_codigo,
            cliente_nome: conta.cliente_nome,
            total_aberto: 0,
            total_titulos: 0,
            dias_medio_atraso: 0,
            maior_atraso: 0,
            contas: [],
            ultima_cobranca: ultimasCobrancas?.[key]
          };
        }
        acc[key].total_aberto += conta.valor_aberto || 0;
        acc[key].total_titulos++;
        acc[key].contas.push(conta);
        acc[key].maior_atraso = Math.max(acc[key].maior_atraso, conta.dias_atraso || 0);
        return acc;
      }, {})
    ).map(cliente => {
      const { score, prioridade } = calcularScore(cliente);
      return {
        ...cliente,
        dias_medio_atraso: Math.round(
          cliente.contas.reduce((sum, c) => sum + (c.dias_atraso || 0), 0) / cliente.contas.length
        ),
        score,
        prioridade
      };
    });

    // Filtros
    return agrupados
      .filter(cliente => cliente.cliente_nome?.toLowerCase().includes(searchCliente.toLowerCase()))
      .filter(cliente => filterPrioridade === 'all' || cliente.prioridade === filterPrioridade)
      .sort((a, b) => b.total_aberto - a.total_aberto);
  }, [contasVencidas, ultimasCobrancas, searchCliente, filterPrioridade]);

  // Calcular KPIs
  const kpis = useMemo(() => {
    const totalVencido = clientesAgrupados.reduce((sum, c) => sum + c.total_aberto, 0);
    const totalClientes = clientesAgrupados.length;
    const totalTitulos = clientesAgrupados.reduce((sum, c) => sum + c.total_titulos, 0);
    const numAcordos = acordosAtivos?.length || 0;
    const valorAcordos = acordosAtivos?.reduce((sum, a) => sum + (a.valor_acordo || 0), 0) || 0;
    const contatosRealizados = cobrancasMes?.length || 0;
    const contatosSucesso = cobrancasMes?.filter(c => ['contatado', 'promessa', 'acordo'].includes(c.status)).length || 0;
    const taxaSucesso = contatosRealizados > 0 ? (contatosSucesso / contatosRealizados) * 100 : 0;
    const ticketMedio = totalClientes > 0 ? totalVencido / totalClientes : 0;
    const diasMedioAtraso = totalClientes > 0 
      ? Math.round(clientesAgrupados.reduce((sum, c) => sum + c.dias_medio_atraso, 0) / totalClientes) 
      : 0;

    // Aging
    const aging = {
      ate30: clientesAgrupados.filter(c => c.maior_atraso <= 30).reduce((sum, c) => sum + c.total_aberto, 0),
      de31a60: clientesAgrupados.filter(c => c.maior_atraso > 30 && c.maior_atraso <= 60).reduce((sum, c) => sum + c.total_aberto, 0),
      de61a90: clientesAgrupados.filter(c => c.maior_atraso > 60 && c.maior_atraso <= 90).reduce((sum, c) => sum + c.total_aberto, 0),
      mais90: clientesAgrupados.filter(c => c.maior_atraso > 90).reduce((sum, c) => sum + c.total_aberto, 0),
    };

    return {
      totalVencido,
      totalClientes,
      totalTitulos,
      acordosAtivos: numAcordos,
      acordosValor: valorAcordos,
      recuperadoMes: valorAcordos * 0.3, // Simulação - idealmente viria de pagamentos confirmados
      metaRecuperacao: totalVencido * 0.1, // 10% do total como meta
      contatosRealizados,
      taxaSucesso,
      ticketMedio,
      diasMedioAtraso,
      aging
    };
  }, [clientesAgrupados, acordosAtivos, cobrancasMes]);

  const getDiasAtrasoBadge = (dias: number) => {
    if (dias >= 90) return <Badge variant="destructive">+90 dias</Badge>;
    if (dias >= 60) return <Badge className="bg-orange-500">60-90 dias</Badge>;
    if (dias >= 30) return <Badge className="bg-yellow-500 text-black">30-60 dias</Badge>;
    return <Badge variant="secondary">{dias} dias</Badge>;
  };

  const getPrioridadeBadge = (prioridade?: string) => {
    switch (prioridade) {
      case 'critical': return <Badge variant="destructive">Crítico</Badge>;
      case 'high': return <Badge className="bg-orange-500">Alto</Badge>;
      case 'medium': return <Badge className="bg-yellow-500 text-black">Médio</Badge>;
      default: return <Badge variant="secondary">Baixo</Badge>;
    }
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              Central de Cobrança
            </h1>
            <p className="text-muted-foreground">Gestão profissional de inadimplência e recuperação de crédito</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/financeiro">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Módulo Financeiro
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard/financeiro/contas-a-receber">
                  Contas a Receber
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Tabs de Visualização */}
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="lista" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                Lista
              </TabsTrigger>
              <TabsTrigger value="fila" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Fila de Trabalho
              </TabsTrigger>
            </TabsList>

            {/* Filtros Globais */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Buscar cliente..."
                value={searchCliente}
                onChange={(e) => setSearchCliente(e.target.value)}
                className="w-[200px]"
              />
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
                    {(filterEmpresas.length > 0 || filterDiasAtraso !== 'all' || filterPrioridade !== 'all') && (
                      <Badge variant="secondary" className="ml-2">
                        {[filterEmpresas.length > 0, filterDiasAtraso !== 'all', filterPrioridade !== 'all'].filter(Boolean).length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px]" align="end">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Empresa</label>
                      <div className="mt-2 max-h-[150px] overflow-auto space-y-1">
                        {empresas.map(emp => (
                          <div key={emp.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`emp-${emp.id}`}
                              checked={filterEmpresas.includes(emp.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFilterEmpresas([...filterEmpresas, emp.id]);
                                } else {
                                  setFilterEmpresas(filterEmpresas.filter(id => id !== emp.id));
                                }
                              }}
                            />
                            <label htmlFor={`emp-${emp.id}`} className="text-sm">{emp.nome}</label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Dias de Atraso</label>
                      <Select value={filterDiasAtraso} onValueChange={setFilterDiasAtraso}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="1">1+ dias</SelectItem>
                          <SelectItem value="15">15+ dias</SelectItem>
                          <SelectItem value="30">30+ dias</SelectItem>
                          <SelectItem value="60">60+ dias</SelectItem>
                          <SelectItem value="90">90+ dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Prioridade</label>
                      <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="critical">Crítico</SelectItem>
                          <SelectItem value="high">Alto</SelectItem>
                          <SelectItem value="medium">Médio</SelectItem>
                          <SelectItem value="low">Baixo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        setFilterEmpresas([]);
                        setFilterDiasAtraso('all');
                        setFilterPrioridade('all');
                      }}
                    >
                      Limpar Filtros
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Dashboard View */}
          <TabsContent value="dashboard" className="mt-6">
            <CobrancaDashboard kpis={kpis} />
          </TabsContent>

          {/* Lista View */}
          <TabsContent value="lista" className="mt-6">
            <div className="space-y-4">
              {isLoading ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <div className="animate-pulse">Carregando inadimplentes...</div>
                  </CardContent>
                </Card>
              ) : clientesAgrupados.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Handshake className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="text-muted-foreground">Nenhum cliente inadimplente encontrado</p>
                  </CardContent>
                </Card>
              ) : (
                clientesAgrupados.map((cliente) => (
                  <Card 
                    key={cliente.cliente_codigo} 
                    className="hover:border-primary/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedCliente(cliente)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              cliente.prioridade === 'critical' ? 'bg-red-500' : 
                              cliente.prioridade === 'high' ? 'bg-orange-500' : 
                              cliente.prioridade === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            <h3 className="font-semibold">{cliente.cliente_nome}</h3>
                            {getPrioridadeBadge(cliente.prioridade)}
                            {getDiasAtrasoBadge(cliente.maior_atraso)}
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{cliente.total_titulos} título(s)</span>
                            <span>•</span>
                            <span>Score: {cliente.score}</span>
                            <span>•</span>
                            <span>Atraso médio: {cliente.dias_medio_atraso} dias</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-destructive">
                            {formatCurrency(cliente.total_aberto)}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Fila de Trabalho */}
          <TabsContent value="fila" className="mt-6">
            <div className="grid md:grid-cols-[350px_1fr] gap-6">
              <FilaCobranca 
                clientes={clientesAgrupados.map(c => ({
                  ...c,
                  score: c.score || 0,
                  prioridade: c.prioridade || 'low'
                }))}
                onSelectCliente={setSelectedCliente}
                metaDiaria={20}
                contatosHoje={cobrancasMes?.filter(c => {
                  const hoje = new Date();
                  const dataAcao = new Date(c.data_acao);
                  return dataAcao.toDateString() === hoje.toDateString();
                }).length || 0}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle>Instruções</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Como usar a fila de trabalho:</h4>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li>1. Os clientes são ordenados por prioridade (score de risco)</li>
                      <li>2. Clientes com retorno agendado aparecem em destaque</li>
                      <li>3. Clique em um cliente para abrir os detalhes</li>
                      <li>4. Registre todas as ações realizadas</li>
                      <li>5. Use os templates para agilizar comunicações</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-red-500/10 rounded-lg text-center">
                      <div className="text-2xl font-bold text-destructive">
                        {clientesAgrupados.filter(c => c.prioridade === 'critical').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Críticos</div>
                    </div>
                    <div className="p-3 bg-orange-500/10 rounded-lg text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {clientesAgrupados.filter(c => c.prioridade === 'high').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Alto Risco</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Drawer de detalhes */}
      <InadimplenteDrawerPro 
        cliente={selectedCliente}
        open={!!selectedCliente}
        onClose={() => setSelectedCliente(null)}
        onRefresh={() => refetch()}
      />
    </DashboardLayout>
  );
}
