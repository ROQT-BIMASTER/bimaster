import React, { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Calendar,
  RefreshCw,
  Filter,
  Table as TableIcon
} from "lucide-react";
import { format, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell } from "recharts";
import { cn } from "@/lib/utils";

// Custom hooks and components
import { useFluxoCaixaData } from "@/hooks/useFluxoCaixaData";
import { FluxoCaixaFilters } from "@/components/fluxocaixa/FluxoCaixaFilters";
import { FluxoCaixaKPIsAdvanced } from "@/components/fluxocaixa/FluxoCaixaKPIsAdvanced";
import { FluxoCaixaYearlyChart } from "@/components/fluxocaixa/FluxoCaixaYearlyChart";
import { FluxoCaixaMovimentacoesTable } from "@/components/fluxocaixa/FluxoCaixaMovimentacoesTable";
import { FluxoCaixaTable } from "@/components/fluxocaixa/FluxoCaixaTable";
import { CashGapAlertsDialog } from "@/components/fluxocaixa/CashGapAlertsDialog";
import { AnaliseInadimplencia } from "@/components/fluxocaixa/AnaliseInadimplencia";

type PeriodType = "daily" | "weekly" | "monthly";

interface CashFlowProjection {
  date: string;
  entradas: number;
  saidas: number;
  saldo: number;
  saldoAcumulado: number;
}

interface AgingBucket {
  label: string;
  range: string;
  valor: number;
  count: number;
  color: string;
}

const FluxoDeCaixa = () => {
  const [period, setPeriod] = useState<PeriodType>("daily");
  const [activeTab, setActiveTab] = useState("visao-geral");
  
  // Filtros - Agora com anos e meses
  const [filterAnos, setFilterAnos] = useState<number[]>([new Date().getFullYear()]);
  const [filterMeses, setFilterMeses] = useState<number[]>([]);
  const [filterEmpresas, setFilterEmpresas] = useState<number[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterVendedor, setFilterVendedor] = useState<string>("todos");
  const [filterCliente, setFilterCliente] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Use custom hook for data fetching
  const {
    contasReceber,
    contasPagar,
    contasReceberRaw,
    isLoading,
    refetch,
    empresas,
    vendedores,
    anosDisponiveis,
    totalRecordsReceber,
    totalRecordsPagar
  } = useFluxoCaixaData({
    filterAnos,
    filterMeses,
    filterEmpresas,
    filterStatus,
    filterVendedor,
    filterCliente
  });

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterAnos.length > 0) count++;
    if (filterMeses.length > 0) count++;
    if (filterEmpresas.length > 0) count++;
    if (filterVendedor !== "todos") count++;
    if (filterCliente.trim()) count++;
    if (filterStatus !== "todos") count++;
    return count;
  }, [filterAnos, filterMeses, filterEmpresas, filterVendedor, filterCliente, filterStatus]);

  const clearFilters = () => {
    setFilterAnos([new Date().getFullYear()]);
    setFilterMeses([]);
    setFilterEmpresas([]);
    setFilterVendedor("todos");
    setFilterCliente("");
    setFilterStatus("todos");
  };

  // Calculate cash flow projections
  const projections = useMemo(() => {
    if (!contasReceber || !contasPagar) return [];

    const today = startOfDay(new Date());
    const data: CashFlowProjection[] = [];
    let saldoAcumulado = 0;

    const getDays = () => {
      switch (period) {
        case "daily": return 30;
        case "weekly": return 12;
        case "monthly": return 12;
        default: return 30;
      }
    };

    const getDateRange = (index: number) => {
      switch (period) {
        case "daily":
          const day = addDays(today, index);
          return { start: startOfDay(day), end: endOfDay(day), label: format(day, "dd/MM") };
        case "weekly":
          const weekStart = addDays(startOfWeek(today, { locale: ptBR }), index * 7);
          return { start: weekStart, end: endOfWeek(weekStart, { locale: ptBR }), label: `Sem ${index + 1}` };
        case "monthly":
          const monthStart = startOfMonth(addDays(today, index * 30));
          return { start: monthStart, end: endOfMonth(monthStart), label: format(monthStart, "MMM/yy", { locale: ptBR }) };
        default:
          return { start: today, end: today, label: "" };
      }
    };

    for (let i = 0; i < getDays(); i++) {
      const { start, end, label } = getDateRange(i);
      
      const entradas = contasReceber
        .filter(c => {
          if (!c.data_vencimento) return false;
          const venc = new Date(c.data_vencimento);
          return venc >= start && venc <= end;
        })
        .reduce((sum, c) => sum + (c.valor_aberto || 0), 0);

      const saidas = contasPagar
        .filter(c => {
          if (!c.data_vencimento) return false;
          const venc = new Date(c.data_vencimento);
          return venc >= start && venc <= end;
        })
        .reduce((sum, c) => sum + (c.valor_aberto || 0), 0);

      const saldo = entradas - saidas;
      saldoAcumulado += saldo;

      data.push({
        date: label,
        entradas,
        saidas,
        saldo,
        saldoAcumulado
      });
    }

    return data;
  }, [contasReceber, contasPagar, period]);

  // Calculate aging buckets for receivables
  const agingReceber = useMemo((): AgingBucket[] => {
    if (!contasReceber) return [];
    
    const today = new Date();
    const buckets = [
      { label: "A Vencer", range: "0-30 dias", min: 0, max: 30, future: true, color: "hsl(var(--chart-1))" },
      { label: "Vencido 1-30", range: "1-30 dias", min: 1, max: 30, future: false, color: "hsl(var(--chart-2))" },
      { label: "Vencido 31-60", range: "31-60 dias", min: 31, max: 60, future: false, color: "hsl(var(--chart-3))" },
      { label: "Vencido 61-90", range: "61-90 dias", min: 61, max: 90, future: false, color: "hsl(var(--chart-4))" },
      { label: "Vencido 90+", range: "> 90 dias", min: 91, max: 9999, future: false, color: "hsl(var(--destructive))" },
    ];

    return buckets.map(bucket => {
      const filtered = contasReceber.filter(c => {
        if (!c.data_vencimento) return false;
        const venc = new Date(c.data_vencimento);
        const diff = differenceInDays(bucket.future ? venc : today, bucket.future ? today : venc);
        return diff >= bucket.min && diff <= bucket.max;
      });

      return {
        label: bucket.label,
        range: bucket.range,
        valor: filtered.reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
        count: filtered.length,
        color: bucket.color
      };
    });
  }, [contasReceber]);

  // Calculate aging buckets for payables
  const agingPagar = useMemo((): AgingBucket[] => {
    if (!contasPagar) return [];
    
    const today = new Date();
    const buckets = [
      { label: "A Vencer", range: "0-30 dias", min: 0, max: 30, future: true, color: "hsl(var(--chart-1))" },
      { label: "Vencido 1-30", range: "1-30 dias", min: 1, max: 30, future: false, color: "hsl(var(--chart-2))" },
      { label: "Vencido 31-60", range: "31-60 dias", min: 31, max: 60, future: false, color: "hsl(var(--chart-3))" },
      { label: "Vencido 61-90", range: "61-90 dias", min: 61, max: 90, future: false, color: "hsl(var(--chart-4))" },
      { label: "Vencido 90+", range: "> 90 dias", min: 91, max: 9999, future: false, color: "hsl(var(--destructive))" },
    ];

    return buckets.map(bucket => {
      const filtered = contasPagar.filter(c => {
        if (!c.data_vencimento) return false;
        const venc = new Date(c.data_vencimento);
        const diff = differenceInDays(bucket.future ? venc : today, bucket.future ? today : venc);
        return diff >= bucket.min && diff <= bucket.max;
      });

      return {
        label: bucket.label,
        range: bucket.range,
        valor: filtered.reduce((sum, c) => sum + (c.valor_aberto || 0), 0),
        count: filtered.length,
        color: bucket.color
      };
    });
  }, [contasPagar]);

  // Cash gap alerts
  const cashGapAlerts = useMemo(() => {
    return projections
      .filter(p => p.saldo < 0)
      .map(p => ({
        date: p.date,
        gap: Math.abs(p.saldo),
        severity: (Math.abs(p.saldo) > 50000 ? "critical" : Math.abs(p.saldo) > 20000 ? "warning" : "info") as "critical" | "warning" | "info"
      }));
  }, [projections]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Period label for display
  const getPeriodLabel = () => {
    if (filterAnos.length === 0) return "Últimos 3 anos + 1 futuro";
    const anos = filterAnos.sort((a, b) => a - b);
    if (filterMeses.length > 0) {
      const meses = filterMeses.map(m => {
        const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return labels[m - 1];
      }).join(", ");
      return `${anos.join(", ")} • ${meses}`;
    }
    return anos.join(", ");
  };

  // Render loading state with skeleton but keep page visible
  const renderLoadingOverlay = () => {
    if (!isLoading) return null;
    return (
      <div className="fixed top-4 right-4 z-50 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border flex items-center gap-2">
        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">Carregando dados...</span>
      </div>
    );
  };

  return (
    <DashboardLayout>
      {renderLoadingOverlay()}
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fluxo de Caixa</h1>
            <p className="text-muted-foreground">
              Projeção de entradas e saídas • {getPeriodLabel()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant={showFilters ? "secondary" : "outline"} 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Painel de Filtros Profissional */}
        {showFilters && (
          <FluxoCaixaFilters
            filterAnos={filterAnos}
            setFilterAnos={setFilterAnos}
            filterMeses={filterMeses}
            setFilterMeses={setFilterMeses}
            filterEmpresas={filterEmpresas}
            setFilterEmpresas={setFilterEmpresas}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterVendedor={filterVendedor}
            setFilterVendedor={setFilterVendedor}
            filterCliente={filterCliente}
            setFilterCliente={setFilterCliente}
            empresas={empresas}
            vendedores={vendedores}
            onClearFilters={clearFilters}
            onApply={refetch}
            totalReceber={contasReceber.length}
            totalPagar={contasPagar.length}
            anosDisponiveis={anosDisponiveis}
          />
        )}

        {/* KPIs Avançados */}
<FluxoCaixaKPIsAdvanced
          contasReceber={contasReceber}
          contasPagar={contasPagar}
          contasReceberRaw={contasReceberRaw}
          filterAnos={filterAnos}
        />

        {/* Cash Gap Alerts */}
        {cashGapAlerts.length > 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2 text-base">
                  <AlertTriangle className="h-5 w-5" />
                  Alertas de Gap de Caixa ({cashGapAlerts.length})
                </CardTitle>
                <CashGapAlertsDialog 
                  alerts={cashGapAlerts}
                  trigger={
                    <Button variant="outline" size="sm" className="gap-2 bg-background">
                      <TableIcon className="h-4 w-4" />
                      Ver Tabela Completa
                    </Button>
                  }
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {cashGapAlerts.slice(0, 5).map((alert, i) => (
                  <Badge 
                    key={i} 
                    variant={alert.severity === "critical" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {alert.date}: {formatCurrency(alert.gap)} negativo
                  </Badge>
                ))}
                {cashGapAlerts.length > 5 && (
                  <CashGapAlertsDialog 
                    alerts={cashGapAlerts}
                    trigger={
                      <Badge variant="outline" className="cursor-pointer hover:bg-muted">
                        +{cashGapAlerts.length - 5} alertas
                      </Badge>
                    }
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="analise-comparativa">Análise Comparativa</TabsTrigger>
            <TabsTrigger value="aging-receber">Aging Receber</TabsTrigger>
            <TabsTrigger value="aging-pagar">Aging Pagar</TabsTrigger>
            <TabsTrigger value="movimentacoes">Movimentações</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="space-y-4">
            {/* Period Selector */}
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant={period === "daily" ? "default" : "outline"}
                onClick={() => setPeriod("daily")}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Diário
              </Button>
              <Button 
                size="sm" 
                variant={period === "weekly" ? "default" : "outline"}
                onClick={() => setPeriod("weekly")}
              >
                Semanal
              </Button>
              <Button 
                size="sm" 
                variant={period === "monthly" ? "default" : "outline"}
                onClick={() => setPeriod("monthly")}
              >
                Mensal
              </Button>
            </div>

            {/* Main Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Projeção de Fluxo de Caixa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projections}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                      />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="entradas" 
                        name="Entradas"
                        stackId="1"
                        stroke="hsl(var(--chart-1))" 
                        fill="hsl(var(--chart-1))"
                        fillOpacity={0.6}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="saidas" 
                        name="Saídas"
                        stackId="2"
                        stroke="hsl(var(--chart-2))" 
                        fill="hsl(var(--chart-2))"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Accumulated Balance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Saldo Acumulado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={projections}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="saldoAcumulado" 
                        name="Saldo Acumulado"
                        stroke="hsl(var(--primary))" 
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Cash Flow Table */}
            <FluxoCaixaTable projections={projections} period={period} />
          </TabsContent>

          {/* Análise Comparativa Tab */}
          <TabsContent value="analise-comparativa" className="space-y-4">
            <FluxoCaixaYearlyChart
              contasReceber={contasReceber}
              contasPagar={contasPagar}
              filterAnos={filterAnos}
            />
          </TabsContent>

          <TabsContent value="aging-receber">
            <AgingReport 
              title="Aging de Contas a Receber" 
              data={agingReceber}
              icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
            />
          </TabsContent>

          <TabsContent value="aging-pagar">
            <AgingReport 
              title="Aging de Contas a Pagar" 
              data={agingPagar}
              icon={<TrendingDown className="h-5 w-5 text-rose-500" />}
            />
          </TabsContent>

          <TabsContent value="movimentacoes">
            <FluxoCaixaMovimentacoesTable 
              contasReceber={contasReceber}
              contasPagar={contasPagar}
            />
          </TabsContent>
        </Tabs>

        {/* Análise de Inadimplência - Sempre no final da página com TODOS os dados */}
        <AnaliseInadimplencia contasReceberRaw={contasReceberRaw} />
      </div>
    </DashboardLayout>
  );
};

// Aging Report Component
const AgingReport = ({ 
  title, 
  data, 
  icon 
}: { 
  title: string; 
  data: AgingBucket[]; 
  icon: React.ReactNode;
}) => {
  const total = data.reduce((sum, d) => sum + d.valor, 0);
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="valor" name="Valor">
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                <span>Faixa</span>
                <span className="text-right">Qtd</span>
                <span className="text-right">Valor</span>
                <span className="text-right">%</span>
              </div>
              {data.map((bucket, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 text-sm py-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bucket.color }} />
                    <span>{bucket.label}</span>
                  </div>
                  <span className="text-right text-muted-foreground">{bucket.count}</span>
                  <span className="text-right font-medium">{formatCurrency(bucket.valor)}</span>
                  <span className="text-right text-muted-foreground">
                    {total > 0 ? ((bucket.valor / total) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              ))}
              <div className="grid grid-cols-4 gap-2 text-sm py-2 border-t font-medium">
                <span>Total</span>
                <span className="text-right">{totalCount}</span>
                <span className="text-right">{formatCurrency(total)}</span>
                <span className="text-right">100%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FluxoDeCaixa;
