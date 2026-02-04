import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCorporateEvents } from "@/hooks/useCorporateEvents";
import { useFinancialPendingItems } from "@/hooks/useEventExpenses";
import { 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Banknote,
  PieChart,
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted))"];

export default function CorporateEventsDashboard() {
  const { events, isLoading } = useCorporateEvents();
  const { data: pendingItems, isLoading: loadingPending } = useFinancialPendingItems();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  // Métricas
  const totalEvents = events.length;
  const activeEvents = events.filter(e => e.status === "approved" || e.status === "in_progress").length;
  const completedEvents = events.filter(e => e.status === "completed").length;
  const totalBudget = events.reduce((sum, e) => sum + (e.budget_amount || 0), 0);
  const totalCost = events.reduce((sum, e) => sum + (e.actual_cost || 0), 0);
  const budgetVariance = totalBudget > 0 ? ((totalCost - totalBudget) / totalBudget) * 100 : 0;
  const pendingFinancialCount = pendingItems?.length || 0;
  const pendingFinancialValue = pendingItems?.reduce((sum, item) => sum + (item.valor_realizado || 0), 0) || 0;

  // Dados para gráfico de status
  const statusData = [
    { name: "Rascunho", value: events.filter(e => e.status === "draft").length, color: "hsl(var(--muted-foreground))" },
    { name: "Aguardando", value: events.filter(e => e.status === "pending_approval").length, color: "hsl(var(--warning))" },
    { name: "Aprovados", value: events.filter(e => e.status === "approved").length, color: "hsl(var(--primary))" },
    { name: "Em Andamento", value: events.filter(e => e.status === "in_progress").length, color: "hsl(var(--success))" },
    { name: "Concluídos", value: completedEvents, color: "hsl(var(--secondary))" },
  ].filter(s => s.value > 0);

  // Dados para gráfico de orçamento vs realizado
  const budgetChartData = events
    .filter(e => e.budget_amount > 0 || e.actual_cost > 0)
    .slice(0, 8)
    .map(e => ({
      name: e.code,
      orcamento: e.budget_amount || 0,
      realizado: e.actual_cost || 0,
    }));

  // Dados por tipo de evento
  const eventTypeData = events.reduce((acc, e) => {
    const type = e.event_type || "outros";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const typeChartData = Object.entries(eventTypeData).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb
          moduleName="Eventos Corporativos"
          moduleHref="/dashboard/eventos"
          currentPage="Dashboard"
        />

        <div>
          <h1 className="text-3xl font-bold">Dashboard de Eventos</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral financeira dos eventos corporativos
          </p>
        </div>

        {/* KPIs Principais */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Total de Eventos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalEvents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeEvents} ativos • {completedEvents} concluídos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Orçamento Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                R$ {totalBudget.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Alocado para todos os eventos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Custo Realizado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                R$ {totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {budgetVariance > 0 ? (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    +{budgetVariance.toFixed(1)}% acima
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {Math.abs(budgetVariance).toFixed(1)}% abaixo
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={pendingFinancialCount > 0 ? "border-amber-500" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Pendentes Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{pendingFinancialCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                R$ {pendingFinancialValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} a pagar
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status dos Eventos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Status dos Eventos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum evento cadastrado
                </div>
              )}
            </CardContent>
          </Card>

          {/* Orçamento vs Realizado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Orçamento vs Realizado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {budgetChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={budgetChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    />
                    <Legend />
                    <Bar dataKey="orcamento" name="Orçamento" fill="hsl(var(--primary))" />
                    <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--success))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Nenhum evento com orçamento
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Eventos por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Eventos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {typeChartData.map((item, index) => (
                <div 
                  key={item.name}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted"
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="font-medium">{item.name}</span>
                  <Badge variant="secondary">{item.value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
