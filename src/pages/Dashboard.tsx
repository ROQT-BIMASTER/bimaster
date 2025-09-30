import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, TrendingUp, Activity } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
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
        const { data: prospects } = await supabase.from("prospects").select("status");
        
        const statusMap: { [key: string]: string } = {
          'novo': 'Novo',
          'contato': 'Contato',
          'proposta': 'Proposta',
          'negociacao': 'Negociação',
          'ganho': 'Ganho'
        };

        const statusOrder = ['novo', 'contato', 'proposta', 'negociacao', 'ganho'];
        const statusCounts = statusOrder.reduce((acc, status) => {
          acc[status] = prospects?.filter(p => p.status === status).length || 0;
          return acc;
        }, {} as { [key: string]: number });

        const total = prospects?.length || 1;
        const pipeline = statusOrder.map(status => ({
          stage: statusMap[status],
          count: statusCounts[status],
          percentage: Math.round((statusCounts[status] / total) * 100)
        }));

        setPipelineData(pipeline);

        // Fetch activity data (last 30 days)
        const thirtyDaysAgo = subDays(new Date(), 30);
        const { data: activities } = await supabase
          .from("atividades")
          .select("data_atividade")
          .gte("data_atividade", thirtyDaysAgo.toISOString());

        const dateRange = eachDayOfInterval({
          start: thirtyDaysAgo,
          end: new Date()
        });

        const activityCounts = dateRange.map(date => {
          const dateStr = format(date, "yyyy-MM-dd");
          const count = activities?.filter(a => 
            format(new Date(a.data_atividade), "yyyy-MM-dd") === dateStr
          ).length || 0;

          return {
            date: format(date, "dd/MM", { locale: ptBR }),
            count
          };
        });

        setActivityData(activityCounts);

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

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline de Vendas</CardTitle>
              <CardDescription>Distribuição de prospects por estágio</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  count: {
                    label: "Prospects",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pipelineData} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis type="category" dataKey="stage" className="text-xs" width={80} />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    {payload[0].payload.stage}
                                  </span>
                                  <span className="font-bold text-muted-foreground">
                                    {payload[0].value} prospects ({payload[0].payload.percentage}%)
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="url(#colorGradient)" 
                      radius={[0, 4, 4, 0]}
                      label={{ position: 'right', formatter: (value: number, entry: any) => `${value} (${entry.percentage}%)` }}
                    />
                    <defs>
                      <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--success))" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Atividades (30 dias)</CardTitle>
              <CardDescription>Volume de atividades registradas</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  count: {
                    label: "Atividades",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityData} margin={{ left: 0, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      interval="preserveStartEnd"
                      tickFormatter={(value, index) => {
                        // Show only first, middle and last dates
                        if (index === 0 || index === activityData.length - 1 || index === Math.floor(activityData.length / 2)) {
                          return value;
                        }
                        return '';
                      }}
                    />
                    <YAxis className="text-xs" />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                              <div className="grid gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[0.70rem] uppercase text-muted-foreground">
                                    {payload[0].payload.date}
                                  </span>
                                  <span className="font-bold text-muted-foreground">
                                    {payload[0].value} atividades
                                  </span>
                                </div>
                              </div>
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
                      dot={{ fill: "hsl(var(--primary))", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
