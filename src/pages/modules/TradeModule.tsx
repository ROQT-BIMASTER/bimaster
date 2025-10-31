import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Store, Calendar, TrendingUp, Target, Camera, Tag, Brain, Zap, DollarSign, Trophy } from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Link, Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { Button } from "@/components/ui/button";
import { QuickEntryDialog } from "@/components/trade/QuickEntryDialog";
import { format, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const TradeModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [stats, setStats] = useState({
    totalStores: 0,
    totalVisits: 0,
    avgCompliance: 0,
    avgShare: 0,
  });
  const [loading, setLoading] = useState(true);
  const [visitsTrend, setVisitsTrend] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [shareTrend, setShareTrend] = useState<any[]>([]);
  const [investmentData, setInvestmentData] = useState<any[]>([]);
  const [complianceTrend, setComplianceTrend] = useState<any[]>([]);

  if (!permissionsLoading && !hasPermission("trade_marketing")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchVisitsTrend(),
        fetchCategoryDistribution(),
        fetchShareTrend(),
        fetchInvestmentData(),
        fetchComplianceTrend()
      ]);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const { count: storesCount } = await supabase
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    const monthStart = startOfMonth(new Date());
    const { count: visitsCount } = await supabase
      .from("visits")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_date", monthStart.toISOString().split("T")[0]);

    const { data: visitsData } = await supabase
      .from("visits")
      .select("compliance_score")
      .eq("status", "completed")
      .not("compliance_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    const avgCompliance = visitsData?.length
      ? visitsData.reduce((acc, v) => acc + (Number(v.compliance_score) || 0), 0) / visitsData.length
      : 0;

    const { data: shareData } = await supabase
      .from("shelf_share_history")
      .select("shelf_share_percentage")
      .order("measurement_date", { ascending: false })
      .limit(50);

    const avgShare = shareData?.length
      ? shareData.reduce((acc, s) => acc + (Number(s.shelf_share_percentage) || 0), 0) / shareData.length
      : 0;

    setStats({
      totalStores: storesCount || 0,
      totalVisits: visitsCount || 0,
      avgCompliance: Number(avgCompliance.toFixed(1)),
      avgShare: Number(avgShare.toFixed(1)),
    });
  };

  const fetchVisitsTrend = async () => {
    const last30Days = subDays(new Date(), 30);
    const { data } = await supabase
      .from("visits")
      .select("scheduled_date, created_at")
      .gte("scheduled_date", last30Days.toISOString().split("T")[0])
      .order("scheduled_date", { ascending: true });

    if (data) {
      const grouped = data.reduce((acc: any, visit) => {
        const week = format(new Date(visit.scheduled_date), "'Sem' w", { locale: ptBR });
        acc[week] = (acc[week] || 0) + 1;
        return acc;
      }, {});

      const trend = Object.entries(grouped).map(([name, visits]) => ({
        name,
        visits: visits as number
      }));

      setVisitsTrend(trend);
    }
  };

  const fetchCategoryDistribution = async () => {
    const { data } = await supabase
      .from("stores")
      .select("category")
      .eq("status", "active");

    if (data) {
      const grouped = data.reduce((acc: any, store) => {
        const category = store.category || "Outros";
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      const colors = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];
      const distribution = Object.entries(grouped).map(([name, value], index) => ({
        name,
        value: value as number,
        color: colors[index % colors.length]
      }));

      setCategoryDistribution(distribution);
    }
  };

  const fetchShareTrend = async () => {
    const last30Days = subDays(new Date(), 30);
    const { data } = await supabase
      .from("shelf_share_history")
      .select("measurement_date, shelf_share_percentage, facing_share_percentage")
      .gte("measurement_date", last30Days.toISOString())
      .order("measurement_date", { ascending: true })
      .limit(30);

    if (data) {
      const trend = data.map(item => ({
        date: format(new Date(item.measurement_date), "dd/MM", { locale: ptBR }),
        shelfShare: Number(item.shelf_share_percentage || 0),
        facingShare: Number(item.facing_share_percentage || 0)
      }));

      setShareTrend(trend);
    }
  };

  const fetchInvestmentData = async () => {
    const last30Days = subDays(new Date(), 30);
    const { data: investments } = await supabase
      .from("trade_investments")
      .select("investment_date, amount")
      .gte("investment_date", last30Days.toISOString().split("T")[0])
      .order("investment_date", { ascending: true });

    const { data: sales } = await supabase
      .from("store_sellout_items")
      .select("created_at, quantity, unit_price")
      .gte("created_at", last30Days.toISOString())
      .order("created_at", { ascending: true });

    if (investments || sales) {
      const grouped: any = {};

      investments?.forEach(inv => {
        const date = format(new Date(inv.investment_date), "dd/MM");
        if (!grouped[date]) grouped[date] = { date, investment: 0, sales: 0 };
        grouped[date].investment += Number(inv.amount || 0);
      });

      sales?.forEach(sale => {
        const date = format(new Date(sale.created_at), "dd/MM");
        if (!grouped[date]) grouped[date] = { date, investment: 0, sales: 0 };
        grouped[date].sales += Number(sale.quantity || 0) * Number(sale.unit_price || 0);
      });

      const investmentTrend = Object.values(grouped);
      setInvestmentData(investmentTrend as any[]);
    }
  };

  const fetchComplianceTrend = async () => {
    const last30Days = subDays(new Date(), 30);
    const { data } = await supabase
      .from("visits")
      .select("scheduled_date, compliance_score")
      .eq("status", "completed")
      .not("compliance_score", "is", null)
      .gte("scheduled_date", last30Days.toISOString().split("T")[0])
      .order("scheduled_date", { ascending: true });

    if (data) {
      const grouped = data.reduce((acc: any, visit) => {
        const date = format(new Date(visit.scheduled_date), "dd/MM");
        if (!acc[date]) acc[date] = { date, total: 0, count: 0 };
        acc[date].total += Number(visit.compliance_score || 0);
        acc[date].count += 1;
        return acc;
      }, {});

      const trend = Object.values(grouped).map((item: any) => ({
        date: item.date,
        compliance: Number((item.total / item.count).toFixed(1))
      }));

      setComplianceTrend(trend);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Módulo de Trade Marketing</h1>
            <p className="text-muted-foreground">
              Monitoramento de PDVs e Performance de Campo
            </p>
          </div>
          <Button 
            size="lg" 
            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            onClick={() => setQuickEntryOpen(true)}
          >
            <Zap className="h-5 w-5" />
            Lançamento Rápido
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">PDVs Ativos</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStores}</div>
              <p className="text-xs text-muted-foreground">+23 vs mês anterior</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Visitas/Mês</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVisits}</div>
              <p className="text-xs text-muted-foreground">87% da meta</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conformidade</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgCompliance}%</div>
              <p className="text-xs text-muted-foreground">+2.3pp vs mês anterior</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Share Médio</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgShare}%</div>
              <p className="text-xs text-muted-foreground">-1.1pp vs mês anterior</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {/* Evolução de Visitas */}
          <Card>
            <CardHeader>
              <CardTitle>Evolução de Visitas (Últimos 30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={visitsTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="visits" 
                    fill="hsl(var(--primary))"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Distribuição por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle>PDVs por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={90}
                    innerRadius={50}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Evolução de Share */}
          <Card>
            <CardHeader>
              <CardTitle>Evolução de Share (Últimos 30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={shareTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="shelfShare" 
                    name="Share Prateleira"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="facingShare" 
                    name="Share Faces"
                    stroke="hsl(var(--secondary))" 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Investimentos vs Vendas */}
          <Card>
            <CardHeader>
              <CardTitle>Investimentos vs Vendas (Últimos 30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={investmentData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="investment" 
                    name="Investimentos"
                    stroke="hsl(var(--destructive))" 
                    fill="hsl(var(--destructive) / 0.2)"
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sales" 
                    name="Vendas"
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução de Conformidade (Últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={complianceTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                />
                <YAxis 
                  className="text-xs"
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => `${value}%`}
                />
                <Area 
                  type="monotone" 
                  dataKey="compliance" 
                  name="Conformidade"
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary) / 0.3)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-3 lg:grid-cols-8">
            <Link to="/dashboard/trade/stores">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Store className="h-4 w-4" />
                PDVs
              </Button>
            </Link>
            <Link to="/dashboard/trade/visits">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Calendar className="h-4 w-4" />
                Visitas
              </Button>
            </Link>
            <Link to="/dashboard/trade/photos">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Camera className="h-4 w-4" />
                Fotos
              </Button>
            </Link>
            <Link to="/dashboard/trade/promotions">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Tag className="h-4 w-4" />
                Promoções
              </Button>
            </Link>
            <Link to="/dashboard/trade/competitors">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Target className="h-4 w-4" />
                Concorrentes
              </Button>
            </Link>
            <Link to="/dashboard/trade/financeiro">
              <Button variant="outline" className="w-full justify-start gap-2">
                <DollarSign className="h-4 w-4" />
                Financeiro
              </Button>
            </Link>
            <Link to="/dashboard/trade/performance">
              <Button variant="outline" className="w-full justify-start gap-2 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30">
                <Trophy className="h-4 w-4 text-primary" />
                Performance
              </Button>
            </Link>
            <Link to="/dashboard/trade/insights">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Brain className="h-4 w-4" />
                Insights IA
              </Button>
            </Link>
          </CardContent>
        </Card>

        <QuickEntryDialog 
          open={quickEntryOpen}
          onOpenChange={setQuickEntryOpen}
          onSuccess={fetchAllData}
        />
      </div>
    </DashboardLayout>
  );
};

export default TradeModule;
