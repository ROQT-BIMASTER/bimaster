import { useMemo, useState } from "react";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  Receipt, AlertCircle, Clock, TrendingUp, TrendingDown, Calendar, Users, 
  BarChart3, PieChart as PieChartIcon, AlertTriangle, CheckCircle2, Hourglass,
  Info, ExternalLink
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface DashboardContasReceberAggregatedProps {
  filterEmpresas: number[];
  filterAnos: number[];
  filterMeses: number[];
  filterConta: string;
  filterPortador: string;
  filterDiaVencimento?: string;
  filterDiaRecebimento?: string;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',
  'hsl(var(--chart-8))',
];

const STATUS_COLORS: { [key: string]: string } = {
  'Recebido': 'hsl(var(--chart-2))',
  'Pendente': 'hsl(var(--chart-3))',
  'Vencido': 'hsl(var(--chart-5))',
  'Parcial': 'hsl(var(--chart-1))',
};

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCompact = (value: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);

// Build common RPC params from component filters
function buildRpcParams(props: DashboardContasReceberAggregatedProps) {
  const { filterEmpresas, filterAnos, filterMeses, filterConta, filterPortador, filterDiaVencimento, filterDiaRecebimento } = props;
  return {
    p_empresas: filterEmpresas.length > 0 ? filterEmpresas : null,
    p_ano: filterAnos.length === 1 ? filterAnos[0] : null,
    p_mes: filterMeses.length === 1 ? filterMeses[0] : null,
    p_conta: filterConta && filterConta !== 'all' ? filterConta : null,
    p_portador: filterPortador && filterPortador !== 'all' ? filterPortador : null,
  };
}

export function DashboardContasReceberAggregated(props: DashboardContasReceberAggregatedProps) {
  const { filterEmpresas, filterAnos, filterMeses, filterConta, filterPortador, filterDiaVencimento, filterDiaRecebimento } = props;
  const [showPmrDetails, setShowPmrDetails] = useState(false);

  const queryKeyBase = useMemo(() => [
    filterEmpresas.join(',') || 'all',
    filterAnos.join(',') || 'all',
    filterMeses.join(',') || 'all',
    filterConta,
    filterPortador,
    filterDiaVencimento ?? '',
    filterDiaRecebimento ?? '',
  ], [filterEmpresas, filterAnos, filterMeses, filterConta, filterPortador, filterDiaVencimento, filterDiaRecebimento]);

  // Fetch all dashboard data via RPCs in parallel
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['contas-receber-dashboard-rpcs', ...queryKeyBase],
    queryFn: async () => {
      const baseParams = buildRpcParams(props);
      const kpiParams = {
        ...baseParams,
        p_data_vencimento: filterDiaVencimento || null,
        p_data_recebimento: filterDiaRecebimento || null,
      };

      // evolucao_mensal does NOT accept p_mes — strip it
      const { p_mes: _pMes, ...evolucaoParams } = baseParams;

      const [kpisRes, evolucaoRes, topClientesRes, agingRes, statusDistRes] = await Promise.all([
        supabase.rpc('get_contas_receber_dashboard_kpis' as any, kpiParams),
        supabase.rpc('get_contas_receber_evolucao_mensal' as any, evolucaoParams),
        supabase.rpc('get_contas_receber_top_clientes' as any, baseParams),
        supabase.rpc('get_contas_receber_aging' as any, baseParams),
        supabase.rpc('get_contas_receber_status_dist' as any, baseParams),
      ]);

      if (kpisRes.error) throw kpisRes.error;
      if (evolucaoRes.error) throw evolucaoRes.error;
      if (topClientesRes.error) throw topClientesRes.error;
      if (agingRes.error) throw agingRes.error;
      if (statusDistRes.error) throw statusDistRes.error;

      return {
        kpis: kpisRes.data as any,
        evolucao: (evolucaoRes.data as any[]) || [],
        topClientes: (topClientesRes.data as any) || [],
        aging: (agingRes.data as any[]) || [],
        statusDist: (statusDistRes.data as any[]) || [],
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // PMR details - only fetched when modal is open
  const { data: pmrDetalhes } = useQuery({
    queryKey: ['contas-receber-pmr-details', ...queryKeyBase],
    queryFn: async () => {
      const baseParams = buildRpcParams(props);
      const { data, error } = await supabase.rpc('get_contas_receber_pmr_detalhes' as any, baseParams);
      if (error) throw error;
      return data as any;
    },
    enabled: showPmrDetails,
    staleTime: 5 * 60 * 1000,
  });

  // Extract data from RPC results
  const kpisData = dashboardData?.kpis || {};
  const evolucao = dashboardData?.evolucao || [];
  const aging = dashboardData?.aging || [];
  
  // Top clientes: RPC returns jsonb, may be array or object with array
  const topClientes = useMemo(() => {
    const raw = dashboardData?.topClientes;
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : (raw.clientes || []);
    return arr.map((c: any) => ({
      nome: (c.cliente_nome || c.nome || 'Sem nome').length > 20 
        ? (c.cliente_nome || c.nome || '').substring(0, 18) + '…' 
        : (c.cliente_nome || c.nome || 'Sem nome'),
      nomeCompleto: c.cliente_nome || c.nome || 'Sem nome',
      valor: c.valor_aberto || c.valor || 0,
    }));
  }, [dashboardData?.topClientes]);

  // Status distribution
  const statusDist = useMemo(() => {
    const raw = dashboardData?.statusDist || [];
    return raw.map((s: any) => ({
      nome: s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1).toLowerCase() : 'Pendente',
      valor: s.valor || s.valor_aberto || 0,
      qtd: s.qtd || s.quantidade || 0,
    }));
  }, [dashboardData?.statusDist]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Carregando dados consolidados...</span>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-8 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards Principais - Resumo de Valores no Topo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Total Recebido</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(kpisData.valor_recebido_total || kpisData.total_valor_recebido || 0)}</div>
            <p className="text-xs text-muted-foreground">{(kpisData.qtd_recebido || 0).toLocaleString()} títulos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Total Pendente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(kpisData.valor_pendente || 0)}</div>
            <p className="text-xs text-muted-foreground">{(kpisData.qtd_pendente || 0).toLocaleString()} títulos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Total Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(kpisData.valor_vencido || 0)}</div>
            <p className="text-xs text-muted-foreground">{(kpisData.qtd_vencido || 0).toLocaleString()} títulos</p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs Estratégicos */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className="cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => setShowPmrDetails(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              Prazo Médio Recebimento
              <Info className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.pmr || 0} dias</div>
            <p className="text-xs text-muted-foreground">Clique para ver detalhes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Índice de Pontualidade</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.indice_pontualidade || 0}%</div>
            <p className="text-xs text-muted-foreground">Recebimentos no prazo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variação Mensal</CardTitle>
            {(kpisData.variacao_mensal || 0) >= 0 
              ? <TrendingUp className="h-4 w-4 text-green-500" />
              : <TrendingDown className="h-4 w-4 text-red-500" />
            }
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(kpisData.variacao_mensal || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(kpisData.variacao_mensal || 0) > 0 ? '+' : ''}{kpisData.variacao_mensal || 0}%
            </div>
            <p className="text-xs text-muted-foreground">Comparado ao mês anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Títulos</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(kpisData.total_titulos || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{formatCompact(kpisData.total_valor_original || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas e Concentração */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencendo Hoje</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.qtd_vencendo_hoje || 0}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpisData.valor_vencendo_hoje || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos 7 dias</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.qtd_vencendo_7dias || 0}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpisData.valor_vencendo_7dias || 0)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos 30 dias</CardTitle>
            <Hourglass className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCompact(kpisData.valor_vencendo_30dias || 0)}</div>
            <p className="text-xs text-muted-foreground">Concentração de vencimentos</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas +30 dias</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{kpisData.qtd_vencidas_30dias || 0}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpisData.valor_vencidas_30dias || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Evolução Mensal - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Evolução Mensal
          </CardTitle>
          <CardDescription>Recebido vs Pendente (últimos 12 meses)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="recebido" name="Recebido" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendente" name="Pendente" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Distribuição por Status + Aging + Top Clientes */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Distribuição por Status
            </CardTitle>
            <CardDescription>Visão geral dos títulos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDist}
                    dataKey="valor"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusDist.map((entry: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STATUS_COLORS[entry.nome] || COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Aging Report */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Aging Report
            </CardTitle>
            <CardDescription>Faixas de vencimento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aging} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <YAxis dataKey="nome" type="category" width={80} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number, name: any, props: any) => [formatCurrency(value), `${props.payload.qtd} títulos`]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top 10 Clientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 10 Clientes Devedores
            </CardTitle>
            <CardDescription>Maiores valores em aberto</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClientes} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <YAxis dataKey="nome" type="category" width={120} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number, name: any, props: any) => [formatCurrency(value), props.payload.nomeCompleto]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Detalhes do PMR */}
      <Dialog open={showPmrDetails} onOpenChange={setShowPmrDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Prazo Médio de Recebimento (PMR) - Detalhes
            </DialogTitle>
            <DialogDescription>
              Análise detalhada do cálculo e distribuição do prazo de recebimento
            </DialogDescription>
          </DialogHeader>

          {pmrDetalhes ? (
            <div className="space-y-6">
              {/* Fórmula */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Fórmula de Cálculo
                </h4>
                <code className="text-sm bg-background px-2 py-1 rounded block">
                  {pmrDetalhes.formula || 'PMR = Σ(Data Recebimento - Data Emissão) / Nº Títulos Recebidos'}
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Período analisado: {pmrDetalhes.periodo?.data_inicio ? new Date(pmrDetalhes.periodo.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '-'} a {pmrDetalhes.periodo?.data_fim ? new Date(pmrDetalhes.periodo.data_fim + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>

              {/* Resumo Principal */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary">
                        {pmrDetalhes.resumo?.pmr_emissao_recebimento ?? 0} dias
                      </div>
                      <p className="text-sm text-muted-foreground">PMR (Emissão → Recebimento)</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${(pmrDetalhes.resumo?.pmr_vencimento_recebimento ?? 0) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(pmrDetalhes.resumo?.pmr_vencimento_recebimento ?? 0) > 0 ? '+' : ''}{pmrDetalhes.resumo?.pmr_vencimento_recebimento ?? 0} dias
                      </div>
                      <p className="text-sm text-muted-foreground">PMR (Vencimento → Recebimento)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(pmrDetalhes.resumo?.pmr_vencimento_recebimento ?? 0) <= 0 ? 'Recebido antes do vencimento' : 'Recebido após o vencimento'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {(pmrDetalhes.resumo?.total_titulos_analisados ?? 0).toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">Títulos Analisados</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Estatísticas */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-lg font-semibold">{pmrDetalhes.resumo?.menor_prazo ?? 0} dias</div>
                  <p className="text-xs text-muted-foreground">Menor Prazo</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-lg font-semibold">{pmrDetalhes.resumo?.mediana_prazo ?? 0} dias</div>
                  <p className="text-xs text-muted-foreground">Mediana</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-lg font-semibold">{pmrDetalhes.resumo?.maior_prazo ?? 0} dias</div>
                  <p className="text-xs text-muted-foreground">Maior Prazo</p>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className="text-lg font-semibold">
                    {pmrDetalhes.resumo && pmrDetalhes.resumo.total_titulos_analisados > 0
                      ? Math.round((pmrDetalhes.resumo.recebidos_no_prazo / pmrDetalhes.resumo.total_titulos_analisados) * 100)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">Pontualidade</p>
                </div>
              </div>

              {/* Distribuição por Faixa */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Distribuição por Faixa de Prazo</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Até 15 dias', value: pmrDetalhes.faixas?.ate_15_dias ?? 0, color: 'bg-green-500' },
                    { label: '16 a 30 dias', value: pmrDetalhes.faixas?.de_16_a_30_dias ?? 0, color: 'bg-blue-500' },
                    { label: '31 a 45 dias', value: pmrDetalhes.faixas?.de_31_a_45_dias ?? 0, color: 'bg-yellow-500' },
                    { label: '46 a 60 dias', value: pmrDetalhes.faixas?.de_46_a_60_dias ?? 0, color: 'bg-orange-500' },
                    { label: 'Acima de 60 dias', value: pmrDetalhes.faixas?.acima_60_dias ?? 0, color: 'bg-red-500' },
                  ].map((faixa) => {
                    const total = (pmrDetalhes.resumo?.total_titulos_analisados ?? 0) || 1;
                    const percent = Math.round((faixa.value / total) * 100);
                    return (
                      <div key={faixa.label} className="flex items-center gap-3">
                        <span className="text-sm w-32">{faixa.label}</span>
                        <div className="flex-1">
                          <Progress value={percent} className={`h-3 [&>div]:${faixa.color}`} />
                        </div>
                        <span className="text-sm font-medium w-16 text-right">{faixa.value} ({percent}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recebidos no Prazo vs Atrasados */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-700 dark:text-green-400">Recebidos no Prazo</p>
                        <div className="text-2xl font-bold text-green-600">{(pmrDetalhes.resumo?.recebidos_no_prazo ?? 0).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{formatCurrency(pmrDetalhes.resumo?.valor_no_prazo ?? 0)}</p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">Recebidos em Atraso</p>
                        <div className="text-2xl font-bold text-red-600">{(pmrDetalhes.resumo?.recebidos_em_atraso ?? 0).toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">{formatCurrency(pmrDetalhes.resumo?.valor_em_atraso ?? 0)}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* PMR por Mês */}
              {pmrDetalhes.por_mes && pmrDetalhes.por_mes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3">Evolução Mensal do PMR</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mês</TableHead>
                        <TableHead className="text-right">Qtd Títulos</TableHead>
                        <TableHead className="text-right">PMR (dias)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pmrDetalhes.por_mes.map((mes: any) => (
                        <TableRow key={mes.mes}>
                          <TableCell>{mes.mes}</TableCell>
                          <TableCell className="text-right">{mes.qtd}</TableCell>
                          <TableCell className="text-right font-medium">{mes.pmr_mes} dias</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Observações */}
              <div className="bg-muted/30 p-4 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Observações</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {(pmrDetalhes.observacoes || [
                    'Considera apenas títulos com status "Recebido" e datas válidas.',
                    'PMR (Emissão → Recebimento): dias entre emissão e recebimento efetivo.',
                    'PMR (Vencimento → Recebimento): valores negativos indicam recebimento antecipado.',
                  ]).map((obs: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {obs}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {showPmrDetails ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Carregando detalhes do PMR...</span>
                </div>
              ) : (
                'Não foi possível carregar os detalhes do PMR'
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
