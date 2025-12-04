import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  DollarSign,
  Calendar,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  BarChart3,
  RefreshCw
} from "lucide-react";
import { format, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell } from "recharts";
import { cn } from "@/lib/utils";

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

  // Fetch contas a receber
  const { data: contasReceber, isLoading: loadingReceber, refetch: refetchReceber } = useQuery({
    queryKey: ["fluxo-caixa-receber"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_receber")
        .select("*")
        .in("status", ["pendente", "parcial", "vencido"])
        .gte("data_vencimento", format(subMonths(new Date(), 3), "yyyy-MM-dd"))
        .lte("data_vencimento", format(addDays(new Date(), 90), "yyyy-MM-dd"));
      
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch contas a pagar
  const { data: contasPagar, isLoading: loadingPagar, refetch: refetchPagar } = useQuery({
    queryKey: ["fluxo-caixa-pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("*")
        .in("status", ["pendente", "parcial", "vencido"])
        .gte("data_vencimento", format(subMonths(new Date(), 3), "yyyy-MM-dd"))
        .lte("data_vencimento", format(addDays(new Date(), 90), "yyyy-MM-dd"));
      
      if (error) throw error;
      return data || [];
    }
  });

  const isLoading = loadingReceber || loadingPagar;

  // Calculate cash flow projections
  const projections = useMemo(() => {
    if (!contasReceber || !contasPagar) return [];

    const today = startOfDay(new Date());
    const data: CashFlowProjection[] = [];
    let saldoAcumulado = 0;

    const getDays = () => {
      switch (period) {
        case "daily": return 30;
        case "weekly": return 12; // 12 weeks
        case "monthly": return 6; // 6 months
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
          const venc = new Date(c.data_vencimento!);
          return venc >= start && venc <= end;
        })
        .reduce((sum, c) => sum + (c.valor_aberto || 0), 0);

      const saidas = contasPagar
        .filter(c => {
          const venc = new Date(c.data_vencimento!);
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
        const venc = new Date(c.data_vencimento!);
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
        const venc = new Date(c.data_vencimento!);
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

  // Calculate KPIs
  const kpis = useMemo(() => {
    if (!contasReceber || !contasPagar) {
      return { dso: 0, dpo: 0, ciclo: 0, totalReceber: 0, totalPagar: 0, saldoProjetado: 0 };
    }

    const today = new Date();
    
    // DSO - Days Sales Outstanding (prazo médio de recebimento)
    const receberVencidos = contasReceber.filter(c => new Date(c.data_vencimento!) < today);
    const totalVencidoReceber = receberVencidos.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const diasVencidosReceber = receberVencidos.reduce((sum, c) => {
      return sum + differenceInDays(today, new Date(c.data_vencimento!)) * (c.valor_aberto || 0);
    }, 0);
    const dso = totalVencidoReceber > 0 ? Math.round(diasVencidosReceber / totalVencidoReceber) : 0;

    // DPO - Days Payable Outstanding (prazo médio de pagamento)
    const pagarVencidos = contasPagar.filter(c => new Date(c.data_vencimento!) < today);
    const totalVencidoPagar = pagarVencidos.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const diasVencidosPagar = pagarVencidos.reduce((sum, c) => {
      return sum + differenceInDays(today, new Date(c.data_vencimento!)) * (c.valor_aberto || 0);
    }, 0);
    const dpo = totalVencidoPagar > 0 ? Math.round(diasVencidosPagar / totalVencidoPagar) : 0;

    // Ciclo Financeiro
    const ciclo = dso - dpo;

    // Totals
    const totalReceber = contasReceber.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const totalPagar = contasPagar.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const saldoProjetado = totalReceber - totalPagar;

    return { dso, dpo, ciclo, totalReceber, totalPagar, saldoProjetado };
  }, [contasReceber, contasPagar]);

  // Cash gap alerts
  const cashGapAlerts = useMemo(() => {
    return projections
      .filter(p => p.saldo < 0)
      .map(p => ({
        date: p.date,
        gap: Math.abs(p.saldo),
        severity: Math.abs(p.saldo) > 50000 ? "critical" : Math.abs(p.saldo) > 20000 ? "warning" : "info"
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

  const handleRefresh = () => {
    refetchReceber();
    refetchPagar();
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fluxo de Caixa</h1>
            <p className="text-muted-foreground">Projeção de entradas e saídas</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Total a Receber</span>
              </div>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(kpis.totalReceber)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownCircle className="h-4 w-4 text-rose-500" />
                <span className="text-xs text-muted-foreground">Total a Pagar</span>
              </div>
              <p className="text-lg font-bold text-rose-600">{formatCurrency(kpis.totalPagar)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Saldo Projetado</span>
              </div>
              <p className={cn("text-lg font-bold", kpis.saldoProjetado >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {formatCurrency(kpis.saldoProjetado)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">DSO (Receber)</span>
              </div>
              <p className="text-lg font-bold">{kpis.dso} dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">DPO (Pagar)</span>
              </div>
              <p className="text-lg font-bold">{kpis.dpo} dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Ciclo Financeiro</span>
              </div>
              <p className={cn("text-lg font-bold", kpis.ciclo <= 0 ? "text-emerald-600" : "text-amber-600")}>
                {kpis.ciclo} dias
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cash Gap Alerts */}
        {cashGapAlerts.length > 0 && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5" />
                Alertas de Gap de Caixa ({cashGapAlerts.length})
              </CardTitle>
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
                  <Badge variant="outline">+{cashGapAlerts.length - 5} alertas</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
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
            <MovimentacoesTable 
              contasReceber={contasReceber || []}
              contasPagar={contasPagar || []}
            />
          </TabsContent>
        </Tabs>
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

// Movimentações Table Component
const MovimentacoesTable = ({ 
  contasReceber, 
  contasPagar 
}: { 
  contasReceber: any[];
  contasPagar: any[];
}) => {
  const [filter, setFilter] = useState<"all" | "receber" | "pagar">("all");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const allMovimentos = useMemo(() => {
    const receber = contasReceber.map(c => ({
      ...c,
      tipo: "receber" as const,
      nome: c.cliente_nome,
      valor: c.valor_aberto
    }));
    
    const pagar = contasPagar.map(c => ({
      ...c,
      tipo: "pagar" as const,
      nome: c.fornecedor_nome,
      valor: c.valor_aberto
    }));

    let combined = [...receber, ...pagar];
    
    if (filter !== "all") {
      combined = combined.filter(m => m.tipo === filter);
    }

    return combined.sort((a, b) => 
      new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime()
    );
  }, [contasReceber, contasPagar, filter]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <CardTitle className="text-base">Movimentações Previstas</CardTitle>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              Todas
            </Button>
            <Button 
              size="sm" 
              variant={filter === "receber" ? "default" : "outline"}
              onClick={() => setFilter("receber")}
            >
              Entradas
            </Button>
            <Button 
              size="sm" 
              variant={filter === "pagar" ? "default" : "outline"}
              onClick={() => setFilter("pagar")}
            >
              Saídas
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2">Vencimento</th>
                <th className="text-left py-2">Tipo</th>
                <th className="text-left py-2">Nome</th>
                <th className="text-left py-2">Documento</th>
                <th className="text-right py-2">Valor</th>
                <th className="text-center py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {allMovimentos.slice(0, 50).map((mov, i) => (
                <tr key={i} className="border-b hover:bg-muted/50">
                  <td className="py-2">
                    {format(new Date(mov.data_vencimento), "dd/MM/yyyy")}
                  </td>
                  <td className="py-2">
                    {mov.tipo === "receber" ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                        <ArrowUpCircle className="h-3 w-3 mr-1" />
                        Entrada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-rose-600 border-rose-200">
                        <ArrowDownCircle className="h-3 w-3 mr-1" />
                        Saída
                      </Badge>
                    )}
                  </td>
                  <td className="py-2 max-w-[200px] truncate">{mov.nome || "-"}</td>
                  <td className="py-2 text-muted-foreground">{mov.numero_documento || "-"}</td>
                  <td className={cn(
                    "py-2 text-right font-medium",
                    mov.tipo === "receber" ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {formatCurrency(mov.valor || 0)}
                  </td>
                  <td className="py-2 text-center">
                    <Badge variant={mov.status === "vencido" ? "destructive" : "secondary"}>
                      {mov.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {allMovimentos.length > 50 && (
            <p className="text-center text-muted-foreground text-sm mt-4">
              Mostrando 50 de {allMovimentos.length} movimentações
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default FluxoDeCaixa;
