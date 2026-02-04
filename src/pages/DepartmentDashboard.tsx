import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDepartmentById } from "@/hooks/useUserDepartments";
import { useDepartmentBudgets } from "@/hooks/useDepartmentBudgets";
import { useDepartmentExpenses } from "@/hooks/useDepartmentExpenses";
import { 
  ArrowLeft,
  DollarSign, 
  TrendingUp, 
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Building2
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function DepartmentDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: department, isLoading: loadingDept } = useDepartmentById(id || "");
  const { budgets, isLoading: loadingBudgets } = useDepartmentBudgets(id || "");
  const { expenses, isLoading: loadingExpenses } = useDepartmentExpenses(id || "");

  const isLoading = loadingDept || loadingBudgets || loadingExpenses;

  // Calcular KPIs
  const activeBudgets = budgets.filter(b => b.status === "active" && b.approval_status === "approved");
  const totalBudget = activeBudgets.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const totalSpent = activeBudgets.reduce((sum, b) => sum + (b.spent_amount || 0), 0);
  const available = totalBudget - totalSpent;
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Despesas por status
  const pendingCount = expenses.filter(e => e.status === "pending").length;
  const approvedCount = expenses.filter(e => e.status === "approved").length;
  const paidCount = expenses.filter(e => e.status === "paid").length;
  const rejectedCount = expenses.filter(e => e.status === "rejected").length;
  const pendingFinancialCount = expenses.filter(e => e.status === "pending_financial").length;

  // Gastos por categoria
  const expensesByCategory = expenses.reduce((acc, expense) => {
    const category = expense.category || "Outros";
    const value = expense.valor_realizado || expense.valor_previsto || 0;
    acc[category] = (acc[category] || 0) + value;
    return acc;
  }, {} as Record<string, number>);

  const categoryData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => b.value - a.value);

  // Gastos últimos 6 meses
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    return {
      month: format(date, "MMM", { locale: ptBR }),
      start: startOfMonth(date),
      end: endOfMonth(date),
      value: 0
    };
  });

  expenses.forEach(expense => {
    if (!expense.expense_date) return;
    const expenseDate = new Date(expense.expense_date);
    const value = expense.valor_realizado || expense.valor_previsto || 0;
    
    last6Months.forEach(month => {
      if (expenseDate >= month.start && expenseDate <= month.end) {
        month.value += value;
      }
    });
  });

  const monthlyData = last6Months.map(m => ({
    name: m.month,
    valor: m.value
  }));

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!department) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Departamento não encontrado</h3>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate("/dashboard/departamentos")}
            >
              Voltar
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb
          moduleName="Departamentos"
          moduleHref="/dashboard/departamentos"
          currentPage={`Dashboard - ${department.nome}`}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(`/dashboard/departamentos/${id}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
              <p className="text-muted-foreground">{department.nome}</p>
            </div>
          </div>
        </div>

        {/* KPIs Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Verba Total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                R$ {totalBudget.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeBudgets.length} verba(s) ativa(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Utilizado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {percentUsed.toFixed(1)}% do orçamento
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Disponível
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                R$ {available.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {(100 - percentUsed).toFixed(1)}% restante
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Total de Despesas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{expenses.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingCount} pendente(s), {pendingFinancialCount} no financeiro
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
            <CardContent className="py-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <div>
                <div className="text-xl font-bold text-amber-700">{pendingCount}</div>
                <div className="text-xs text-amber-600">Pendentes</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <CardContent className="py-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-xl font-bold text-blue-700">{approvedCount}</div>
                <div className="text-xs text-blue-600">Aprovadas</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200">
            <CardContent className="py-4 flex items-center gap-3">
              <FileText className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-xl font-bold text-purple-700">{pendingFinancialCount}</div>
                <div className="text-xs text-purple-600">No Financeiro</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
            <CardContent className="py-4 flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="text-xl font-bold text-emerald-700">{paidCount}</div>
                <div className="text-xs text-emerald-600">Pagas</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 dark:bg-red-950/20 border-red-200">
            <CardContent className="py-4 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <div className="text-xl font-bold text-red-700">{rejectedCount}</div>
                <div className="text-xs text-red-600">Rejeitadas</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Evolução Mensal */}
          <Card>
            <CardHeader>
              <CardTitle>Evolução de Gastos (6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis 
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [
                        `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                        "Valor"
                      ]}
                    />
                    <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle>Despesas por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {categoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [
                          `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                          "Valor"
                        ]}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Nenhuma despesa registrada
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
