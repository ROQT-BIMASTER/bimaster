import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Receipt, AlertCircle, Clock, TrendingUp, TrendingDown, Calendar, Users, 
  BarChart3, PieChart as PieChartIcon, AlertTriangle, CheckCircle2, Hourglass
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line
} from "recharts";

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

export function DashboardContasReceberAggregated({ 
  filterEmpresas, 
  filterAnos, 
  filterMeses, 
  filterConta, 
  filterPortador,
  filterDiaVencimento,
  filterDiaRecebimento
}: DashboardContasReceberAggregatedProps) {
  
  // Preparar parâmetros para as RPCs
  // IMPORTANTE: As RPCs usam p_ano (single) e p_mes (single)
  // Se não houver filtro de ano, deixar null para usar o range padrão da RPC
  // Se houver 1 ano, passar o ano específico
  // Se houver múltiplos anos, passar null (RPC usará range padrão que é mais amplo)
  const rpcParams = useMemo(() => {
    // Para ano: se nenhum selecionado ou múltiplos, deixar null (RPC usa últimos 3 anos + 1 futuro)
    // Se apenas 1 selecionado, passar esse ano
    const anoParam = filterAnos.length === 1 ? filterAnos[0] : null;
    
    // Para mês: só aplicar se também tiver 1 ano selecionado
    const mesParam = filterAnos.length === 1 && filterMeses.length === 1 ? filterMeses[0] : null;
    
    // Se tem filtro de dia específico, extrair ano e mês dele
    let finalAnoParam = anoParam;
    let finalMesParam = mesParam;
    
    if (filterDiaVencimento) {
      const dateParts = filterDiaVencimento.split('-');
      if (dateParts.length === 3) {
        finalAnoParam = parseInt(dateParts[0], 10);
        finalMesParam = parseInt(dateParts[1], 10);
      }
    }
    
    return {
      p_empresas: filterEmpresas.length > 0 ? filterEmpresas : null,
      p_ano: finalAnoParam,
      p_mes: finalMesParam,
      p_conta: filterConta !== 'all' ? filterConta : null,
      p_portador: filterPortador !== 'all' ? filterPortador : null,
      p_data_vencimento: filterDiaVencimento || null,
      p_data_recebimento: filterDiaRecebimento || null,
    };
  }, [filterEmpresas, filterAnos, filterMeses, filterConta, filterPortador, filterDiaVencimento, filterDiaRecebimento]);

  // Query KPIs
  const { data: kpis, isLoading: isLoadingKpis } = useQuery({
    queryKey: ['contas-receber-kpis', rpcParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_contas_receber_dashboard_kpis', rpcParams as any);
      if (error) throw error;
      return data as {
        total_titulos: number;
        total_valor_original: number;
        total_valor_aberto: number;
        total_valor_recebido: number;
        qtd_recebido: number;
        valor_recebido_total: number;
        qtd_pendente: number;
        valor_pendente: number;
        qtd_vencido: number;
        valor_vencido: number;
        qtd_vencendo_hoje: number;
        valor_vencendo_hoje: number;
        qtd_vencendo_7dias: number;
        valor_vencendo_7dias: number;
        valor_vencendo_15dias: number;
        valor_vencendo_30dias: number;
        qtd_vencidas_30dias: number;
        valor_vencidas_30dias: number;
        total_mes_atual: number;
        total_mes_anterior: number;
        variacao_mensal: number;
        pmr: number;
        indice_pontualidade: number;
      };
    }
  });

  // Query Evolução Mensal - usando rpcParams como dependência
  const { data: evolucao, isLoading: isLoadingEvolucao } = useQuery({
    queryKey: ['contas-receber-evolucao', rpcParams],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_contas_receber_evolucao_mensal', {
        p_empresas: rpcParams.p_empresas,
        p_ano: rpcParams.p_ano,
        p_conta: rpcParams.p_conta,
        p_portador: rpcParams.p_portador,
      });
      if (error) throw error;
      return (data || []) as { mes: string; recebido: number; pendente: number }[];
    }
  });

  // Parâmetros simplificados para RPCs que não suportam p_data_vencimento e p_data_recebimento
  const rpcParamsSimple = useMemo(() => ({
    p_empresas: rpcParams.p_empresas,
    p_ano: rpcParams.p_ano,
    p_mes: rpcParams.p_mes,
    p_conta: rpcParams.p_conta,
    p_portador: rpcParams.p_portador,
  }), [rpcParams]);

  // Query Top Clientes
  const { data: topClientes, isLoading: isLoadingTop } = useQuery({
    queryKey: ['contas-receber-top', rpcParamsSimple],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_contas_receber_top_clientes', rpcParamsSimple as any);
      if (error) throw error;
      return (data || []) as { nome: string; nomeCompleto: string; valor: number }[];
    }
  });

  // Query Aging Report
  const { data: aging, isLoading: isLoadingAging } = useQuery({
    queryKey: ['contas-receber-aging', rpcParamsSimple],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_contas_receber_aging', rpcParamsSimple as any);
      if (error) throw error;
      return (data || []) as { nome: string; valor: number; qtd: number }[];
    }
  });

  // Query Status Distribution
  const { data: statusDist, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['contas-receber-status', rpcParamsSimple],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_contas_receber_status_dist', rpcParamsSimple as any);
      if (error) throw error;
      return (data || []) as { nome: string; valor: number; qtd: number }[];
    }
  });

  const isLoading = isLoadingKpis || isLoadingEvolucao || isLoadingTop || isLoadingAging || isLoadingStatus;

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

  const kpisData = kpis || {
    total_titulos: 0, total_valor_original: 0, total_valor_aberto: 0, total_valor_recebido: 0,
    qtd_recebido: 0, valor_recebido_total: 0, qtd_pendente: 0, valor_pendente: 0,
    qtd_vencido: 0, valor_vencido: 0, qtd_vencendo_hoje: 0, valor_vencendo_hoje: 0,
    qtd_vencendo_7dias: 0, valor_vencendo_7dias: 0, valor_vencendo_15dias: 0, valor_vencendo_30dias: 0,
    qtd_vencidas_30dias: 0, valor_vencidas_30dias: 0, total_mes_atual: 0, total_mes_anterior: 0,
    variacao_mensal: 0, pmr: 0, indice_pontualidade: 0
  };

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
            <div className="text-2xl font-bold text-green-600">{formatCurrency(kpisData.valor_recebido_total)}</div>
            <p className="text-xs text-muted-foreground">{kpisData.qtd_recebido.toLocaleString()} títulos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Total Pendente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(kpisData.valor_pendente)}</div>
            <p className="text-xs text-muted-foreground">{kpisData.qtd_pendente.toLocaleString()} títulos</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Total Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(kpisData.valor_vencido)}</div>
            <p className="text-xs text-muted-foreground">{kpisData.qtd_vencido.toLocaleString()} títulos</p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs Estratégicos */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazo Médio Recebimento</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.pmr} dias</div>
            <p className="text-xs text-muted-foreground">Média entre emissão e recebimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Índice de Pontualidade</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.indice_pontualidade}%</div>
            <p className="text-xs text-muted-foreground">Recebimentos no prazo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variação Mensal</CardTitle>
            {kpisData.variacao_mensal >= 0 
              ? <TrendingUp className="h-4 w-4 text-green-500" />
              : <TrendingDown className="h-4 w-4 text-red-500" />
            }
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpisData.variacao_mensal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {kpisData.variacao_mensal > 0 ? '+' : ''}{kpisData.variacao_mensal}%
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
            <div className="text-2xl font-bold">{kpisData.total_titulos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{formatCompact(kpisData.total_valor_original)}</p>
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
            <div className="text-2xl font-bold">{kpisData.qtd_vencendo_hoje}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpisData.valor_vencendo_hoje)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos 7 dias</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisData.qtd_vencendo_7dias}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpisData.valor_vencendo_7dias)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos 30 dias</CardTitle>
            <Hourglass className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCompact(kpisData.valor_vencendo_30dias)}</div>
            <p className="text-xs text-muted-foreground">Concentração de vencimentos</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidas +30 dias</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{kpisData.qtd_vencidas_30dias}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(kpisData.valor_vencidas_30dias)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Evolução Mensal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Evolução Mensal
            </CardTitle>
            <CardDescription>Recebido vs Pendente (últimos 6 meses)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={evolucao || []}>
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

        {/* Distribuição por Status */}
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
                    data={statusDist || []}
                    dataKey="valor"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(statusDist || []).map((entry, index) => (
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
      </div>

      {/* Aging e Top Clientes */}
      <div className="grid gap-6 md:grid-cols-2">
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
                <BarChart data={aging || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <YAxis dataKey="nome" type="category" width={80} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number, name, props) => [formatCurrency(value), `${props.payload.qtd} títulos`]}
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
                <BarChart data={topClientes || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCompact(v)} className="text-xs" />
                  <YAxis dataKey="nome" type="category" width={120} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number, name, props) => [formatCurrency(value), props.payload.nomeCompleto]}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
