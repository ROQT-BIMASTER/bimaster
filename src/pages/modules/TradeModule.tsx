import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Store, Calendar, TrendingUp, Target, Camera, Tag, Brain, Zap } from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link, Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { Button } from "@/components/ui/button";
import { QuickEntryDialog } from "@/components/trade/QuickEntryDialog";

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

  if (!permissionsLoading && !hasPermission("trade_marketing")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { count: storesCount } = await supabase
        .from("stores")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const { count: visitsCount } = await supabase
        .from("visits")
        .select("*", { count: "exact", head: true })
        .gte("scheduled_date", startOfMonth.toISOString().split("T")[0]);

      const { data: visitsData } = await supabase
        .from("visits")
        .select("compliance_score")
        .eq("status", "completed")
        .not("compliance_score", "is", null);

      const avgCompliance = visitsData?.length
        ? visitsData.reduce((acc, v) => acc + (Number(v.compliance_score) || 0), 0) / visitsData.length
        : 0;

      setStats({
        totalStores: storesCount || 0,
        totalVisits: visitsCount || 0,
        avgCompliance: Number(avgCompliance.toFixed(1)),
        avgShare: 34.2,
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const visitsTrend = [
    { name: "Sem 1", visits: 850 },
    { name: "Sem 2", visits: 920 },
    { name: "Sem 3", visits: 880 },
    { name: "Sem 4", visits: 950 },
  ];

  const categoryDistribution = [
    { name: "Supermercados", value: 45, color: "hsl(var(--chart-1))" },
    { name: "Farmácias", value: 25, color: "hsl(var(--chart-2))" },
    { name: "Atacados", value: 20, color: "hsl(var(--chart-3))" },
    { name: "Conveniências", value: 10, color: "hsl(var(--chart-4))" },
  ];

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

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Evolução de Visitas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={visitsTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Categoria</CardTitle>
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
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
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
          onSuccess={fetchStats}
        />
      </div>
    </DashboardLayout>
  );
};

export default TradeModule;
