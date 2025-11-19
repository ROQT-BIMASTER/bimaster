import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Target, TrendingUp, Award, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PerformanceMetrics {
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  totalVisits: number;
  totalAudits: number;
  totalPhotos: number;
  averageCompliance: number;
  currentStreak: number;
  bestStreak: number;
  completionRate: number;
}

export const PerformanceMetricsCard = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalPoints: 0,
    weeklyPoints: 0,
    monthlyPoints: 0,
    totalVisits: 0,
    totalAudits: 0,
    totalPhotos: 0,
    averageCompliance: 0,
    currentStreak: 0,
    bestStreak: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar pontos totais
      const { data: rankingData } = await supabase
        .from("user_rankings")
        .select("total_points, streak_days")
        .eq("user_id", user.id)
        .eq("period_type", "all_time")
        .maybeSingle();

      // Buscar pontos semanais
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: weeklyPoints } = await supabase
        .from("user_points_history")
        .select("final_points")
        .eq("user_id", user.id)
        .gte("earned_at", oneWeekAgo.toISOString());

      // Buscar pontos mensais
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const { data: monthlyPoints } = await supabase
        .from("user_points_history")
        .select("final_points")
        .eq("user_id", user.id)
        .gte("earned_at", oneMonthAgo.toISOString());

      // Buscar total de visitas
      const { count: visitsCount } = await supabase
        .from("visits")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Buscar total de auditorias
      const { count: auditsCount } = await supabase
        .from("gondola_audits")
        .select("*", { count: "exact", head: true })
        .eq("created_by", user.id);

      // Buscar total de fotos
      const { count: photosCount } = await supabase
        .from("photos")
        .select("*", { count: "exact", head: true })
        .eq("vendedor_id", user.id);

      // Calcular compliance médio das auditorias
      const { data: complianceData } = await supabase
        .from("gondola_audits")
        .select("conforme_planograma")
        .eq("created_by", user.id);

      const totalCompliant = complianceData?.filter(a => a.conforme_planograma).length || 0;
      const averageCompliance = complianceData && complianceData.length > 0
        ? (totalCompliant / complianceData.length) * 100
        : 0;

      // Calcular taxa de completude de visitas
      const { data: visitsData } = await supabase
        .from("visits")
        .select("check_in_time, check_out_time, notes, duration_minutes")
        .eq("user_id", user.id);

      const completeVisits = visitsData?.filter(v => 
        v.check_in_time && v.check_out_time && v.notes && v.duration_minutes
      ).length || 0;
      
      const completionRate = visitsData && visitsData.length > 0
        ? (completeVisits / visitsData.length) * 100
        : 0;

      setMetrics({
        totalPoints: rankingData?.total_points || 0,
        weeklyPoints: weeklyPoints?.reduce((sum, p) => sum + p.final_points, 0) || 0,
        monthlyPoints: monthlyPoints?.reduce((sum, p) => sum + p.final_points, 0) || 0,
        totalVisits: visitsCount || 0,
        totalAudits: auditsCount || 0,
        totalPhotos: photosCount || 0,
        averageCompliance: Math.round(averageCompliance),
        currentStreak: rankingData?.streak_days || 0,
        bestStreak: rankingData?.streak_days || 0, // Poderia vir de outro lugar
        completionRate: Math.round(completionRate),
      });
    } catch (error) {
      console.error("Erro ao buscar métricas:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Métricas de Desempenho
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Carregando métricas...
          </div>
        </CardContent>
      </Card>
    );
  }

  const metricCards = [
    {
      label: "Pontos Semanais",
      value: metrics.weeklyPoints,
      icon: TrendingUp,
      color: "text-blue-500",
      trend: "+12%",
    },
    {
      label: "Pontos Mensais",
      value: metrics.monthlyPoints,
      icon: Award,
      color: "text-green-500",
      trend: "+8%",
    },
    {
      label: "Visitas Realizadas",
      value: metrics.totalVisits,
      icon: Calendar,
      color: "text-purple-500",
    },
    {
      label: "Auditorias",
      value: metrics.totalAudits,
      icon: Target,
      color: "text-orange-500",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Métricas de Desempenho
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grid de Métricas Principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map((metric) => (
            <div key={metric.label} className="p-4 border rounded-lg bg-secondary/20">
              <div className="flex items-center justify-between mb-2">
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
                {metric.trend && (
                  <Badge variant="secondary" className="text-xs">
                    {metric.trend}
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold">{metric.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
            </div>
          ))}
        </div>

        {/* Métricas de Qualidade */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg text-center">
            <p className="text-muted-foreground text-sm mb-1">Compliance Médio</p>
            <p className="text-3xl font-bold text-primary">{metrics.averageCompliance}%</p>
          </div>
          <div className="p-4 border rounded-lg text-center">
            <p className="text-muted-foreground text-sm mb-1">Sequência Atual</p>
            <p className="text-3xl font-bold text-primary">{metrics.currentStreak} dias</p>
          </div>
          <div className="p-4 border rounded-lg text-center">
            <p className="text-muted-foreground text-sm mb-1">Taxa de Completude</p>
            <p className="text-3xl font-bold text-primary">{metrics.completionRate}%</p>
          </div>
        </div>

        {/* Fotos Enviadas */}
        <div className="p-4 border rounded-lg bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total de Fotos</p>
              <p className="text-2xl font-bold">{metrics.totalPhotos}</p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              +30 pts cada
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
