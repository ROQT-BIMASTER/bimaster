import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  RefreshCw,
  Building2,
  CheckCircle,
  ChevronsUpDown,
  Filter,
  X,
  User,
  FileText,
  ExternalLink,
  Table as TableIcon
} from "lucide-react";
import { format, addDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { FluxoCaixaTable } from "@/components/fluxocaixa/FluxoCaixaTable";
import { CashGapAlertsDialog } from "@/components/fluxocaixa/CashGapAlertsDialog";

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
  
  // Filtros profissionais
  const [filterEmpresas, setFilterEmpresas] = useState<number[]>([]);
  const [filterDataInicio, setFilterDataInicio] = useState<string>(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [filterDataFim, setFilterDataFim] = useState<string>(format(addDays(new Date(), 90), "yyyy-MM-dd"));
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterVendedor, setFilterVendedor] = useState<string>("todos");
  const [filterCliente, setFilterCliente] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Fetch contas a receber
  const { data: contasReceberRaw, isLoading: loadingReceber, refetch: refetchReceber } = useQuery({
    queryKey: ["fluxo-caixa-receber", filterDataInicio, filterDataFim, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("contas_receber")
        .select("*")
        .gte("data_vencimento", filterDataInicio)
        .lte("data_vencimento", filterDataFim);
      
      if (filterStatus !== "todos") {
        query = query.eq("status", filterStatus);
      } else {
        query = query.in("status", ["pendente", "parcial", "vencido"]);
      }
      
      const { data, error } = await query.limit(50000);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch contas a pagar
  const { data: contasPagarRaw, isLoading: loadingPagar, refetch: refetchPagar } = useQuery({
    queryKey: ["fluxo-caixa-pagar", filterDataInicio, filterDataFim, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("contas_pagar")
        .select("*")
        .gte("data_vencimento", filterDataInicio)
        .lte("data_vencimento", filterDataFim);
      
      if (filterStatus !== "todos") {
        query = query.eq("status", filterStatus);
      } else {
        query = query.in("status", ["pendente", "parcial", "vencido"]);
      }
      
      const { data, error } = await query.limit(50000);
      if (error) throw error;
      return data || [];
    }
  });

  const isLoading = loadingReceber || loadingPagar;

  // Extrair empresas únicas
  const empresas = useMemo(() => {
    const all = [...(contasReceberRaw || []), ...(contasPagarRaw || [])];
    const seen = new Map<number, string>();
    all.forEach(c => {
      if (c.empresa_id && c.empresa_nome && !seen.has(c.empresa_id)) {
        seen.set(c.empresa_id, c.empresa_nome);
      }
    });
    return Array.from(seen.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [contasReceberRaw, contasPagarRaw]);

  // Extrair vendedores únicos
  const vendedores = useMemo(() => {
    const all = contasReceberRaw || [];
    const seen = new Set<string>();
    all.forEach(c => {
      if (c.vendedor_nome) seen.add(c.vendedor_nome);
    });
    return Array.from(seen).sort();
  }, [contasReceberRaw]);

  // Filtrar dados
  const contasReceber = useMemo(() => {
    if (!contasReceberRaw) return [];
    let filtered = contasReceberRaw;
    
    if (filterEmpresas.length > 0) {
      filtered = filtered.filter(c => filterEmpresas.includes(c.empresa_id));
    }
    if (filterVendedor !== "todos") {
      filtered = filtered.filter(c => c.vendedor_nome === filterVendedor);
    }
    if (filterCliente.trim()) {
      const search = filterCliente.toLowerCase();
      filtered = filtered.filter(c => 
        c.cliente_nome?.toLowerCase().includes(search) ||
        c.cliente_codigo?.toLowerCase().includes(search)
      );
    }
    return filtered;
  }, [contasReceberRaw, filterEmpresas, filterVendedor, filterCliente]);

  const contasPagar = useMemo(() => {
    if (!contasPagarRaw) return [];
    let filtered = contasPagarRaw;
    
    if (filterEmpresas.length > 0) {
      filtered = filtered.filter(c => filterEmpresas.includes(c.empresa_id));
    }
    return filtered;
  }, [contasPagarRaw, filterEmpresas]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterEmpresas.length > 0) count++;
    if (filterVendedor !== "todos") count++;
    if (filterCliente.trim()) count++;
    if (filterStatus !== "todos") count++;
    return count;
  }, [filterEmpresas, filterVendedor, filterCliente, filterStatus]);

  const clearFilters = () => {
    setFilterEmpresas([]);
    setFilterVendedor("todos");
    setFilterCliente("");
    setFilterStatus("todos");
    setFilterDataInicio(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
    setFilterDataFim(format(addDays(new Date(), 90), "yyyy-MM-dd"));
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
        case "monthly": return 6;
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
    
    // DSO - Days Sales Outstanding
    const receberVencidos = contasReceber.filter(c => new Date(c.data_vencimento!) < today);
    const totalVencidoReceber = receberVencidos.reduce((sum, c) => sum + (c.valor_aberto || 0), 0);
    const diasVencidosReceber = receberVencidos.reduce((sum, c) => {
      return sum + differenceInDays(today, new Date(c.data_vencimento!)) * (c.valor_aberto || 0);
    }, 0);
    const dso = totalVencidoReceber > 0 ? Math.round(diasVencidosReceber / totalVencidoReceber) : 0;

    // DPO - Days Payable Outstanding
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
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Painel de Filtros Profissional */}
        {showFilters && (
          <Card className="border-primary/20 bg-muted/30">
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {/* Data Início */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Data Início</Label>
                  <Input
                    type="date"
                    value={filterDataInicio}
                    onChange={(e) => setFilterDataInicio(e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Data Fim */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Data Fim</Label>
                  <Input
                    type="date"
                    value={filterDataFim}
                    onChange={(e) => setFilterDataFim(e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Empresa */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Empresa</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between h-9 text-sm">
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {filterEmpresas.length === 0 
                              ? "Todas" 
                              : `${filterEmpresas.length} selecionada(s)`}
                          </span>
                        </div>
                        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <div className="p-2 border-b">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full justify-start text-sm"
                          onClick={() => setFilterEmpresas([])}
                        >
                          <CheckCircle className={`mr-2 h-4 w-4 ${filterEmpresas.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                          Todas as empresas
                        </Button>
                      </div>
                      <div className="max-h-[200px] overflow-auto p-2 space-y-1">
                        {empresas.map(emp => (
                          <div key={emp.id} className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded">
                            <Checkbox
                              id={`filter-emp-${emp.id}`}
                              checked={filterEmpresas.includes(emp.id)}
                              onCheckedChange={(checked) => {
                                if (checked) setFilterEmpresas([...filterEmpresas, emp.id]);
                                else setFilterEmpresas(filterEmpresas.filter(id => id !== emp.id));
                              }}
                            />
                            <label htmlFor={`filter-emp-${emp.id}`} className="text-sm cursor-pointer flex-1 truncate">
                              {emp.nome}
                            </label>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                      <SelectItem value="vencido">Vencido</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Vendedor */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Vendedor</Label>
                  <Select value={filterVendedor} onValueChange={setFilterVendedor}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {vendedores.map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cliente/Fornecedor */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Cliente/Fornecedor</Label>
                  <div className="relative">
                    <Input
                      placeholder="Buscar..."
                      value={filterCliente}
                      onChange={(e) => setFilterCliente(e.target.value)}
                      className="h-9 pr-8"
                    />
                    {filterCliente && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-9 w-8"
                        onClick={() => setFilterCliente("")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="text-xs text-muted-foreground">
                  {contasReceber.length} entradas • {contasPagar.length} saídas
                </div>
                <div className="flex gap-2">
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Limpar filtros
                    </Button>
                  )}
                  <Button size="sm" onClick={() => { refetchReceber(); refetchPagar(); }}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

            {/* Cash Flow Table - Similar to CIGAM */}
            <FluxoCaixaTable projections={projections} period={period} />
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
                <th className="text-left py-2">Empresa</th>
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
                  <td className="py-2 text-muted-foreground text-xs">{mov.empresa_nome || "-"}</td>
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