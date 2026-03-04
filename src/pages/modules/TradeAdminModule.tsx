import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  ArrowRight,
  Target,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  FileText,
  Settings,
  Users,
  ChevronDown,
  Zap,
  Wallet,
  PiggyBank,
  ClipboardCheck,
  Receipt,
  BarChart3,
  LayoutDashboard,
  CreditCard,
  ScrollText,
  BookOpen
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { TourButton, tradeAdminTourSteps, TRADE_ADMIN_TOUR_ID } from "@/components/tour";

const TradeAdminModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const { data: stats } = useQuery({
    queryKey: ['trade-admin-stats'],
    queryFn: async () => {
      const [campaignsRes, budgetsRes, pendingApprovalsRes] = await Promise.all([
        supabase.from("trade_campaigns").select("*"),
        supabase.from("trade_budgets").select("total_amount, spent_amount, available_amount").eq("status", "active").is("inactivated_at", null),
        supabase.from("trade_approvals").select("*", { count: "exact", head: true }).eq("status", "pending")
      ]);

      const campaigns = campaignsRes.data || [];
      const activeCampaigns = campaigns.filter(c => c.status === "in_progress" || c.status === "approved").length;
      const totalInvested = campaigns.reduce((sum, c) => sum + parseFloat(String(c.actual_cost || 0)), 0);
      const totalRevenue = campaigns.reduce((sum, c) => sum + parseFloat(String(c.actual_revenue || 0)), 0);
      const roi = totalInvested > 0 ? ((totalRevenue - totalInvested) / totalInvested) * 100 : 0;

      const budgets = budgetsRes.data || [];
      const totalBudget = budgets.reduce((sum, b) => sum + parseFloat(String(b.total_amount || 0)), 0);
      const usedBudget = budgets.reduce((sum, b) => sum + parseFloat(String(b.spent_amount || 0)), 0);
      const availableBudget = budgets.reduce((sum, b) => sum + parseFloat(String(b.available_amount || 0)), 0);

      return {
        totalCampaigns: campaigns.length,
        activeCampaigns,
        totalInvested,
        roi,
        totalBudget,
        usedBudget,
        availableBudget,
        pendingApprovals: pendingApprovalsRes.count || 0
      };
    }
  });

  if (!permissionsLoading && !hasPermission("trade_admin")) {
    return <Navigate to="/dashboard/trade" replace />;
  }

  // Módulos secundários agrupados
  const secondaryModules = {
    "Configurações": [
      { title: "Níveis de Aprovação", to: "/dashboard/trade/admin/approval-levels", icon: Settings, color: "text-slate-600" },
      { title: "Usuários e Perfis", to: "/dashboard/trade/admin/users", icon: Users, color: "text-blue-600" },
      { title: "Plano de Contas", to: "/dashboard/plano-contas", icon: BookOpen, color: "text-teal-600" },
    ],
    "Relatórios": [
      { title: "Relatório por Campanha", to: "/dashboard/trade/admin/reports/campaigns", icon: FileText, color: "text-green-600" },
      { title: "Relatório por Cliente", to: "/dashboard/trade/admin/reports/clients", icon: BarChart3, color: "text-purple-600" },
      { title: "Relatório por Vendedor", to: "/dashboard/trade/admin/reports/sellers", icon: Users, color: "text-orange-600" },
    ],
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
        {/* Header */}
        <div className="flex items-center gap-4 px-1" data-tour="admin-header">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard/trade">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Administrativo Trade</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
              Campanhas, verbas, financeiro e aprovações
            </p>
          </div>
        </div>

        {/* KPIs Principais */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4" data-tour="admin-kpis">
          {/* Campanhas Ativas */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-start justify-between">
                <div className="p-2 sm:p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                  <Target className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="mt-2 sm:mt-4">
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {stats?.activeCampaigns || 0}
                </p>
                <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5">Campanhas Ativas</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground">de {stats?.totalCampaigns || 0} total</p>
              </div>
            </CardContent>
          </Card>

          {/* Total Investido */}
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-start justify-between">
                <div className="p-2 sm:p-2.5 bg-green-100 dark:bg-green-900/50 rounded-lg">
                  <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="mt-2 sm:mt-4">
                <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  R$ {((stats?.totalInvested || 0) / 1000).toFixed(0)}k
                </p>
                <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5">Total Investido</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground">em campanhas</p>
              </div>
            </CardContent>
          </Card>

          {/* Saldo Disponível */}
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-start justify-between">
                <div className="p-2 sm:p-2.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                  <PiggyBank className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="mt-2 sm:mt-4">
                <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                  R$ {((stats?.availableBudget || 0) / 1000).toFixed(0)}k
                </p>
                <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5">Saldo Disponível</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  de R$ {((stats?.totalBudget || 0) / 1000).toFixed(0)}k em verbas
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Aprovações Pendentes */}
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-start justify-between">
                <div className="p-2 sm:p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                  <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
                </div>
                {(stats?.pendingApprovals || 0) > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {stats?.pendingApprovals}
                  </Badge>
                )}
              </div>
              <div className="mt-2 sm:mt-4">
                <p className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {stats?.pendingApprovals || 0}
                </p>
                <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5">Pendentes</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground">aguardando aprovação</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* === OPERACIONAL === */}
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3 px-1 uppercase tracking-wider">
            <Target className="h-4 w-4" />
            <span>Operacional</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-tour="admin-quick-actions">
            {/* Campanhas */}
            <Link to="/dashboard/trade/financeiro/campanhas">
              <Card className="group hover:shadow-lg active:scale-[0.98] transition-all duration-200 h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                      <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="mt-4">Campanhas</CardTitle>
                  <CardDescription>Gestão completa de campanhas com ROI e validação</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>{stats?.activeCampaigns || 0} ativas</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{(stats?.totalCampaigns || 0) - (stats?.activeCampaigns || 0)} outras</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Lançamentos */}
            <Link to="/dashboard/trade/financeiro/lancamentos">
              <Card className="group hover:shadow-lg active:scale-[0.98] transition-all duration-200 h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-xl">
                      <Receipt className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="mt-4">Lançamentos</CardTitle>
                  <CardDescription>Registros de despesas e investimentos</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            {/* Painel de Lançamentos */}
            <Link to="/dashboard/trade/financeiro/lancamentos-campanhas">
              <Card className="group hover:shadow-lg active:scale-[0.98] transition-all duration-200 h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-rose-100 dark:bg-rose-900/50 rounded-xl">
                      <ScrollText className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="mt-4">Painel de Lançamentos</CardTitle>
                  <CardDescription>Resultados e execução de campanhas</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>

        {/* === FINANCEIRO === */}
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3 px-1 uppercase tracking-wider">
            <DollarSign className="h-4 w-4" />
            <span>Financeiro</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Verbas */}
            <Link to="/dashboard/trade/financeiro/verbas">
              <Card className="group hover:shadow-lg active:scale-[0.98] transition-all duration-200 h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-xl">
                      <PiggyBank className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="mt-4">Verbas</CardTitle>
                  <CardDescription>Orçamentos e controle de verbas semestrais</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Disponível</span>
                      <span className="font-medium text-green-600">
                        R$ {((stats?.availableBudget || 0) / 1000).toFixed(0)}k
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ 
                          width: `${stats?.totalBudget ? ((stats?.usedBudget || 0) / stats.totalBudget) * 100 : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Dashboard Financeiro */}
            <Link to="/dashboard/trade/financeiro/dashboard">
              <Card className="group hover:shadow-lg active:scale-[0.98] transition-all duration-200 h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl">
                      <LayoutDashboard className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="mt-4">Dashboard Financeiro</CardTitle>
                  <CardDescription>Visão consolidada de verbas e campanhas</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            {/* Contas Correntes */}
            <Link to="/dashboard/trade/financeiro/contas">
              <Card className="group hover:shadow-lg active:scale-[0.98] transition-all duration-200 h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-cyan-100 dark:bg-cyan-900/50 rounded-xl">
                      <Wallet className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="mt-4">Contas Correntes</CardTitle>
                  <CardDescription>Gestão de contas e extratos</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            {/* Meu Extrato */}
            <Link to="/dashboard/trade/financeiro/extrato">
              <Card className="group hover:shadow-lg active:scale-[0.98] transition-all duration-200 h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-sky-100 dark:bg-sky-900/50 rounded-xl">
                      <FileText className="h-6 w-6 text-sky-600 dark:text-sky-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="mt-4">Meu Extrato</CardTitle>
                  <CardDescription>Histórico de lançamentos e aprovações</CardDescription>
                </CardHeader>
              </Card>
            </Link>

            {/* Contas a Pagar */}
            <Link to="/dashboard/contas-a-pagar">
              <Card className="group hover:shadow-lg active:scale-[0.98] transition-all duration-200 h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-xl">
                      <CreditCard className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="mt-4">Contas a Pagar</CardTitle>
                  <CardDescription>Gestão de contas e orçamentos</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>

        {/* === GESTÃO === */}
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3 px-1 uppercase tracking-wider">
            <ClipboardCheck className="h-4 w-4" />
            <span>Gestão</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Aprovações */}
            <Link to="/dashboard/trade/financeiro/aprovacoes">
              <Card className="group hover:shadow-lg active:scale-[0.98] transition-all duration-200 h-full cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                      <ClipboardCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      {(stats?.pendingApprovals || 0) > 0 && (
                        <Badge variant="destructive">{stats?.pendingApprovals}</Badge>
                      )}
                      <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <CardTitle className="mt-4">Aprovações</CardTitle>
                  <CardDescription>Fluxo de aprovação hierárquica</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-amber-600">
                      <Clock className="h-4 w-4" />
                      <span>{stats?.pendingApprovals || 0} pendentes</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Visão Executiva */}
            <Link to="/dashboard/trade/admin/executivo">
              <Card className="group hover:shadow-lg active:scale-[0.98] transition-all duration-200 h-full cursor-pointer relative overflow-hidden">
                <div className="absolute top-2 right-2">
                  <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[10px] px-1.5">
                    NOVO
                  </Badge>
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                      <LayoutDashboard className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <CardTitle className="mt-4">Visão Executiva</CardTitle>
                  <CardDescription>Painel consolidado para diretoria</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>

        {/* Módulos Secundários */}
        <div className="space-y-2" data-tour="admin-settings">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 sm:mb-3 px-1">
            <Zap className="h-4 w-4" />
            <span>Mais funcionalidades</span>
          </div>

          {Object.entries(secondaryModules).map(([category, modules]) => (
            <Collapsible
              key={category}
              open={openSections[category]}
              onOpenChange={() => toggleSection(category)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted active:bg-muted/70 transition-colors touch-manipulation">
                <span className="font-medium text-sm">{category}</span>
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    openSections[category] && "rotate-180"
                  )} 
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 pl-1 sm:pl-2" data-tour="admin-reports">
                  {modules.map((module) => (
                    <Link 
                      key={module.to} 
                      to={module.to}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-background border hover:bg-muted/50 active:bg-muted/70 hover:border-primary/30 transition-colors text-sm touch-manipulation"
                    >
                      <module.icon className={cn("h-4 w-4 flex-shrink-0", module.color)} />
                      <span className="truncate">{module.title}</span>
                    </Link>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

        {/* Tour Button */}
        <TourButton 
          tourId={TRADE_ADMIN_TOUR_ID}
          tourSteps={tradeAdminTourSteps}
          title="Tour Administrativo"
          description="Conheça as funções administrativas"
        />
      </div>
    </DashboardLayout>
  );
};

export default TradeAdminModule;
