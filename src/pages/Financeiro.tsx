import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  DollarSign, 
  FileText, 
  BookOpen, 
  Receipt, 
  TrendingUp, 
  Calendar,
  Wallet,
  CheckCircle,
  ArrowRight,
  Store,
  BarChart3
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Financeiro() {
  // Buscar estatísticas financeiras
  const { data: stats } = useQuery({
    queryKey: ['financial-stats'],
    queryFn: async () => {
      const [budgetsRes, investmentsRes, contasRes, accountsRes] = await Promise.all([
        supabase.from("trade_budgets").select("*"),
        supabase.from("trade_investments").select("*"),
        supabase.from("contas_pagar").select("*"),
        supabase.from("trade_chart_of_accounts").select("*", { count: 'exact', head: true })
      ]);

      const totalBudget = budgetsRes.data?.reduce((sum, b) => sum + (parseFloat(b.total_amount as any) || 0), 0) || 0;
      const totalSpent = budgetsRes.data?.reduce((sum, b) => sum + (parseFloat(b.spent_amount as any) || 0), 0) || 0;
      const totalInvestments = investmentsRes.data?.reduce((sum, i) => sum + (parseFloat(i.amount as any) || 0), 0) || 0;
      const contasPendentes = contasRes.data?.filter(c => c.status === 'pendente').length || 0;
      const totalContas = accountsRes.count || 0;

      return {
        totalBudget,
        totalSpent,
        totalAvailable: totalBudget - totalSpent,
        totalInvestments,
        contasPendentes,
        totalContas
      };
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Módulo Financeiro</h1>
          <p className="text-muted-foreground mt-1">
            Gestão completa de finanças, verbas, investimentos e contabilidade
          </p>
        </div>

        {/* KPIs Financeiros */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Verbas</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {(stats?.totalBudget || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                R$ {(stats?.totalInvestments || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Contas Pendentes</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats?.contasPendentes || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Plano de Contas</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats?.totalContas || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navegação Rápida - Gestão de Verbas e Investimentos */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Gestão de Verbas e Investimentos</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link to="/dashboard/trade/financeiro">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gestão de Verbas</CardTitle>
                  <Store className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Verbas, investimentos por PDV e plano de contas
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Acessar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/financeiro/extrato">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Meu Extrato</CardTitle>
                  <FileText className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Histórico de lançamentos e aprovações
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Ver extrato <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/financeiro/aprovacoes">
              <Card className="hover:border-orange-500 cursor-pointer transition-colors border-orange-500/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aprovações</CardTitle>
                  <CheckCircle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Revisar e aprovar lançamentos pendentes
                  </p>
                  <div className="mt-2 flex items-center text-xs text-orange-600">
                    Revisar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Navegação Rápida - Campanhas e Contas */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Campanhas e Contas Correntes</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/trade/financeiro/campanhas">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Campanhas</CardTitle>
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestão de campanhas e aprovações
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/financeiro/contas">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas Correntes</CardTitle>
                  <Wallet className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestão de contas correntes por cliente
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/financeiro/verbas">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Verbas Semestrais</CardTitle>
                  <Calendar className="h-4 w-4 text-cyan-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Planejamento e acompanhamento semestral
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/financeiro/lancamentos">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lançamentos</CardTitle>
                  <FileText className="h-4 w-4 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Todos os lançamentos financeiros
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Navegação Rápida - Contas a Pagar e Receber */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Contas a Pagar e Receber</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/financeiro/contas-a-pagar">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas a Pagar</CardTitle>
                  <Receipt className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestão de contas a pagar e orçamentos
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/financeiro/contas-a-receber">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas a Receber</CardTitle>
                  <Receipt className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestão de recebimentos e clientes
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/financeiro/cobranca">
              <Card className="hover:border-destructive cursor-pointer transition-colors border-destructive/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cobrança Inadimplentes</CardTitle>
                  <Receipt className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestão de cobranças e acordos
                  </p>
                  <div className="mt-2 flex items-center text-xs text-destructive">
                    Cobrar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/financeiro/plano-contas">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Plano de Contas</CardTitle>
                  <BookOpen className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Estrutura contábil hierárquica CPC/IFRS
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Visualizar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Navegação Rápida - Análises */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Análises e Relatórios</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link to="/dashboard/financeiro/dre-analitico">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">DRE Analítico</CardTitle>
                  <BarChart3 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Demonstrativo de resultado com drill-down
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Visualizar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/financeiro/visao-departamentos">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Visão Departamental</CardTitle>
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Análise por departamento com IA
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Ver análise <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/financeiro/classificar-banco">
              <Card className="hover:border-primary cursor-pointer transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Classificação IA</CardTitle>
                  <FileText className="h-4 w-4 text-cyan-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Classificação automática de lançamentos
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Classificar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
