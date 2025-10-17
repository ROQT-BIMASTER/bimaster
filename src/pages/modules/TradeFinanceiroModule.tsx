import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  FileText, 
  PieChart,
  ArrowRight,
  Wallet,
  Receipt
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function TradeFinanceiroModule() {
  const { hasPermission } = useScreenPermissions();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBudgets: 0,
    totalSpent: 0,
    totalAvailable: 0,
    activeBudgets: 0,
    monthlyInvestments: 0,
    pendingEntries: 0,
  });

  useEffect(() => {
    if (!hasPermission("trade_marketing")) {
      navigate("/dashboard");
    }
  }, [hasPermission, navigate]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [budgetsRes, investmentsRes, entriesRes] = await Promise.all([
        supabase.from("trade_budgets").select("total_amount, spent_amount, status"),
        supabase.from("trade_investments").select("amount, investment_date"),
        supabase.from("trade_financial_entries").select("status"),
      ]);

      if (budgetsRes.data) {
        const total = budgetsRes.data.reduce((sum, b) => {
          const amount = b.total_amount ? parseFloat(String(b.total_amount)) : 0;
          return sum + amount;
        }, 0);
        const spent = budgetsRes.data.reduce((sum, b) => {
          const amount = b.spent_amount ? parseFloat(String(b.spent_amount)) : 0;
          return sum + amount;
        }, 0);
        const active = budgetsRes.data.filter(b => b.status === "active").length;
        
        setStats(prev => ({
          ...prev,
          totalBudgets: total,
          totalSpent: spent,
          totalAvailable: total - spent,
          activeBudgets: active,
        }));
      }

      if (investmentsRes.data) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const monthlyTotal = investmentsRes.data
          .filter(inv => {
            const date = new Date(inv.investment_date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
          })
          .reduce((sum, inv) => {
            const amount = inv.amount ? parseFloat(String(inv.amount)) : 0;
            return sum + amount;
          }, 0);
        
        setStats(prev => ({ ...prev, monthlyInvestments: monthlyTotal }));
      }

      if (entriesRes.data) {
        const pending = entriesRes.data.filter(e => e.status === "pending").length;
        setStats(prev => ({ ...prev, pendingEntries: pending }));
      }
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const quickActions = [
    {
      title: "Gestão de Verbas",
      description: "Controle completo de verbas, investimentos e saldo disponível",
      icon: Wallet,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      path: "/dashboard/trade/financeiro/verbas",
    },
    {
      title: "Lançamentos Financeiros",
      description: "Registre e gerencie todos os lançamentos financeiros do Trade Marketing",
      icon: Receipt,
      color: "text-green-600",
      bgColor: "bg-green-50",
      path: "/dashboard/trade/financeiro/lancamentos",
    },
    {
      title: "Plano de Contas",
      description: "Visualize e gerencie o plano de contas contábil",
      icon: FileText,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      path: "/dashboard/trade/financeiro/plano-contas",
    },
    {
      title: "Relatórios",
      description: "Análises detalhadas e relatórios financeiros consolidados",
      icon: PieChart,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      path: "/dashboard/trade/financeiro/relatorios",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Financeiro Trade Marketing</h1>
          <p className="text-muted-foreground mt-1">
            Central de controle financeiro para gestão de verbas e investimentos
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Verbas</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalBudgets)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeBudgets} verbas ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalSpent)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(stats.monthlyInvestments)} neste mês
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Disponível</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalAvailable)}</div>
              {stats.pendingEntries > 0 && (
                <Badge variant="outline" className="mt-1">
                  {stats.pendingEntries} lançamentos pendentes
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ações Rápidas */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Acesso Rápido</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card 
                  key={action.path} 
                  className="hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => navigate(action.path)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`p-3 rounded-lg ${action.bgColor}`}>
                        <Icon className={`h-6 w-6 ${action.color}`} />
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <CardTitle className="mt-4">{action.title}</CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Informações Adicionais */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Período Atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Acompanhe o desempenho financeiro mensal e compare com períodos anteriores
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate("/dashboard/trade/financeiro/relatorios")}
              >
                Ver Relatórios
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Últimas Atualizações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Mantenha-se informado sobre os últimos lançamentos e movimentações financeiras
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate("/dashboard/trade/financeiro/lancamentos")}
              >
                Ver Lançamentos
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
