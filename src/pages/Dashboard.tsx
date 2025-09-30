import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, TrendingUp, Activity } from "lucide-react";

interface Stats {
  totalProspects: number;
  totalMunicipios: number;
  prospectsEmNegociacao: number;
  atividadesHoje: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalProspects: 0,
    totalMunicipios: 0,
    prospectsEmNegociacao: 0,
    atividadesHoje: 0,
  });
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

        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo ao CRM Sistema</CardTitle>
            <CardDescription>
              Gerencie seus prospects, municípios e atividades de forma eficiente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Use o menu lateral para navegar entre as diferentes seções do sistema. Você pode
              gerenciar prospects, visualizar municípios atribuídos e registrar atividades.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
