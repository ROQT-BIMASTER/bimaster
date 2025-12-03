import { memo, useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ProspectsStats {
  totalProspects: number;
  prospectsEmNegociacao: number;
  atividadesHoje: number;
}

export const ProspectsDashboardWidget = memo(() => {
  const [stats, setStats] = useState<ProspectsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [prospectsResult, negociacaoResult, atividadesResult] = await Promise.all([
          supabase.from("prospects").select("*", { count: "exact", head: true }),
          supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", "negociacao"),
          supabase
            .from("atividades")
            .select("*", { count: "exact", head: true })
            .gte("data_atividade", new Date().toISOString().split("T")[0]),
        ]);

        setStats({
          totalProspects: prospectsResult.count || 0,
          prospectsEmNegociacao: negociacaoResult.count || 0,
          atividadesHoje: atividadesResult.count || 0,
        });
      } catch (error) {
        console.error("Erro ao carregar stats de prospects:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = useMemo(() => [
    {
      title: "Total de Prospects",
      value: stats?.totalProspects || 0,
      icon: Users,
      description: "Prospects cadastrados",
    },
    {
      title: "Em Negociação",
      value: stats?.prospectsEmNegociacao || 0,
      icon: TrendingUp,
      description: "Prospects em negociação",
    },
    {
      title: "Atividades Hoje",
      value: stats?.atividadesHoje || 0,
      icon: Activity,
      description: "Atividades registradas",
    },
  ], [stats]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
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
  );
});

ProspectsDashboardWidget.displayName = "ProspectsDashboardWidget";
