import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, TrendingUp, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Stats {
  totalProspects: number;
  totalMunicipios: number;
  prospectsEmNegociacao: number;
  atividadesHoje: number;
}

interface PipelineData {
  stage: string;
  count: number;
  percentage: number;
  fill: string;
}

interface ActivityData {
  date: string;
  count: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalProspects: 0,
    totalMunicipios: 0,
    prospectsEmNegociacao: 0,
    atividadesHoje: 0,
  });
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [prospectsResult, municipiosResult, negociacaoResult, atividadesResult] = await Promise.all([
          supabase.from("prospects").select("*", { count: "exact", head: true }),
          supabase.from("municipios").select("*", { count: "exact", head: true }),
          supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", "negociacao"),
          supabase
            .from("atividades")
            .select("*", { count: "exact", head: true })
            .gte("data_atividade", new Date().toISOString().split("T")[0]),
        ]);

        setStats({
          totalProspects: prospectsResult.count || 0,
          totalMunicipios: municipiosResult.count || 0,
          prospectsEmNegociacao: negociacaoResult.count || 0,
          atividadesHoje: atividadesResult.count || 0,
        });

        // Fetch pipeline data
        const stages = ['novo', 'em_contato', 'proposta_enviada', 'negociacao', 'ganho'] as const;
        const stageLabels = ['Novo', 'Contato', 'Proposta', 'Negociação', 'Ganho'];
        const stageColors = ['hsl(217, 91%, 60%)', 'hsl(199, 89%, 48%)', 'hsl(173, 58%, 39%)', 'hsl(142, 71%, 45%)', 'hsl(120, 100%, 40%)'];
        
        const pipelineCounts = await Promise.all(
          stages.map(stage =>
            supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", stage)
          )
        );

        const total = pipelineCounts.reduce((sum, result) => sum + (result.count || 0), 0);
        
        const pipeline = stages.map((stage, index) => ({
          stage: stageLabels[index],
          count: pipelineCounts[index].count || 0,
          percentage: total > 0 ? Math.round(((pipelineCounts[index].count || 0) / total) * 100) : 0,
          fill: stageColors[index],
        }));

        setPipelineData(pipeline);

        // Fetch activity data for last 30 days
        const dates = Array.from({ length: 30 }, (_, i) => {
          const date = subDays(new Date(), 29 - i);
          return format(startOfDay(date), 'yyyy-MM-dd');
        });

        const activityCounts = await Promise.all(
          dates.map(date =>
            supabase
              .from("atividades")
              .select("*", { count: "exact", head: true })
              .gte("data_atividade", date)
              .lt("data_atividade", format(subDays(new Date(date), -1), 'yyyy-MM-dd'))
          )
        );

        const activities = dates.map((date, index) => ({
          date: format(new Date(date), 'dd/MM', { locale: ptBR }),
          count: activityCounts[index].count || 0,
        }));

        setActivityData(activities);
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: "Total de Prospects",
      value: stats.totalProspects,
      icon: Users,
      description: "Prospects cadastrados",
    },
    {
      title: "Municípios",
      value: stats.totalMunicipios,
      icon: Building2,
      description: "Municípios atendidos",
    },
    {
      title: "Em Negociação",
      value: stats.prospectsEmNegociacao,
      icon: TrendingUp,
      description: "Prospects em negociação",
    },
    {
      title: "Atividades Hoje",
      value: stats.atividadesHoje,
      icon: Activity,
      description: "Atividades registradas hoje",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Visão geral do seu CRM</p>
        </div>

        {loading ? (
          <div className="text-center py-8">Carregando estatísticas...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline de Vendas</CardTitle>
              <CardDescription>Funil de conversão dos prospects</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={pipelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-card border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold">{payload[0].payload.stage}</p>
                            <p className="text-sm">Prospects: {payload[0].payload.count}</p>
                            <p className="text-sm">Percentual: {payload[0].payload.percentage}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {pipelineData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Atividades - Últimos 30 Dias</CardTitle>
              <CardDescription>Linha do tempo de atividades registradas</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-card border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold">{payload[0].payload.date}</p>
                            <p className="text-sm">Atividades: {payload[0].payload.count}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
