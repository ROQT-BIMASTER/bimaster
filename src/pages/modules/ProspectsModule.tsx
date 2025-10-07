import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, TrendingUp, Activity, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const ProspectsModule = () => {
  const [stats, setStats] = useState({
    totalProspects: 0,
    prospectsEmNegociacao: 0,
    atividadesHoje: 0,
    taxaConversao: 0,
  });
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [prospectsResult, negociacaoResult, atividadesResult, ganhosResult] = await Promise.all([
        supabase.from("prospects").select("*", { count: "exact", head: true }),
        supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", "negociacao"),
        supabase
          .from("atividades")
          .select("*", { count: "exact", head: true })
          .gte("data_atividade", new Date().toISOString().split("T")[0]),
        supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", "ganho"),
      ]);

      const total = prospectsResult.count || 0;
      const ganhos = ganhosResult.count || 0;
      const taxaConversao = total > 0 ? Math.round((ganhos / total) * 100) : 0;

      setStats({
        totalProspects: total,
        prospectsEmNegociacao: negociacaoResult.count || 0,
        atividadesHoje: atividadesResult.count || 0,
        taxaConversao,
      });

      // Fetch pipeline data
      const stages = ['novo', 'em_contato', 'proposta_enviada', 'negociacao', 'ganho', 'perdido'] as const;
      const stageLabels = ['Novo', 'Contato', 'Proposta', 'Negociação', 'Ganho', 'Perdido'];
      
      const pipelineCounts = await Promise.all(
        stages.map(stage =>
          supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", stage)
        )
      );

      const pipeline = stages.map((stage, index) => ({
        name: stageLabels[index],
        value: pipelineCounts[index].count || 0,
      }));

      setPipelineData(pipeline);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Módulo de Prospects</h1>
          <p className="text-muted-foreground">
            Gestão completa de prospects e pipeline de vendas
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Prospects</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProspects}</div>
              <p className="text-xs text-muted-foreground">
                Prospects cadastrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Negociação</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.prospectsEmNegociacao}</div>
              <p className="text-xs text-muted-foreground">
                Prospects em negociação
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atividades Hoje</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.atividadesHoje}</div>
              <p className="text-xs text-muted-foreground">
                Atividades registradas hoje
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.taxaConversao}%</div>
              <p className="text-xs text-muted-foreground">
                Prospects convertidos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-4">
            <Link to="/dashboard/prospects/list">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Users className="h-4 w-4" />
                Ver Todos os Prospects
              </Button>
            </Link>
            <Link to="/dashboard/prospects/kanban">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Target className="h-4 w-4" />
                Visualizar Kanban
              </Button>
            </Link>
            <Link to="/dashboard/prospects/atividades">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Activity className="h-4 w-4" />
                Gerenciar Atividades
              </Button>
            </Link>
            <Link to="/dashboard/prospects/mapa">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Activity className="h-4 w-4" />
                Ver Mapa
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ProspectsModule;
