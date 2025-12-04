import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { 
  Target, CheckCircle, Clock, AlertTriangle, 
  Rocket, TrendingUp, Flame, Award 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: number;
  color: string;
  pulse?: boolean;
}

const KPICard = ({ title, value, subtitle, icon, trend, color, pulse }: KPICardProps) => (
  <Card className={cn(
    "relative overflow-hidden p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
    "bg-gradient-to-br from-background to-muted/30 border-border/50"
  )}>
    <div className={cn(
      "absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20",
      color
    )} />
    <div className="flex items-start justify-between relative z-10">
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className={cn(
          "text-3xl font-bold",
          pulse && "animate-pulse"
        )}>{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium",
            trend >= 0 ? "text-green-500" : "text-red-500"
          )}>
            <TrendingUp className={cn("h-3 w-3", trend < 0 && "rotate-180")} />
            {Math.abs(trend)}% vs semana anterior
          </div>
        )}
      </div>
      <div className={cn(
        "p-3 rounded-xl",
        color.replace("bg-", "bg-").replace("/20", "/10")
      )}>
        {icon}
      </div>
    </div>
  </Card>
);

export function MissionControlKPIs() {
  const { data: stats } = useQuery({
    queryKey: ['mission-control-kpis'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Tarefas totais
      const { count: totalTasks } = await supabase
        .from('lancamentos_tarefas_marketing')
        .select('*', { count: 'exact', head: true });
      
      // Tarefas pendentes
      const { count: pendingTasks } = await supabase
        .from('lancamentos_tarefas_marketing')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pendente', 'em_andamento']);
      
      // Tarefas concluídas esta semana
      const { count: completedThisWeek } = await supabase
        .from('lancamentos_tarefas_marketing')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'concluida')
        .gte('updated_at', weekAgo);
      
      // Tarefas com alerta de gargalo
      const { count: bottleneckTasks } = await supabase
        .from('lancamentos_tarefas_marketing')
        .select('*', { count: 'exact', head: true })
        .eq('alerta_gargalo', true);
      
      // Lançamentos ativos
      const { count: activeLaunches } = await supabase
        .from('lancamentos_produtos')
        .select('*', { count: 'exact', head: true })
        .in('status', ['planejado', 'em_preparacao']);
      
      // Taxa de conclusão no prazo (simulado)
      const onTimeRate = 78;
      
      return {
        totalTasks: totalTasks || 0,
        pendingTasks: pendingTasks || 0,
        completedThisWeek: completedThisWeek || 0,
        bottleneckTasks: bottleneckTasks || 0,
        activeLaunches: activeLaunches || 0,
        onTimeRate
      };
    },
    refetchInterval: 30000 // Refresh every 30s
  });

  const kpis = [
    {
      title: "Tarefas Ativas",
      value: stats?.pendingTasks || 0,
      subtitle: `de ${stats?.totalTasks || 0} total`,
      icon: <Target className="h-6 w-6 text-blue-500" />,
      color: "bg-blue-500/20",
      trend: 12
    },
    {
      title: "Concluídas (Semana)",
      value: stats?.completedThisWeek || 0,
      subtitle: "últimos 7 dias",
      icon: <CheckCircle className="h-6 w-6 text-green-500" />,
      color: "bg-green-500/20",
      trend: 8
    },
    {
      title: "Taxa No Prazo",
      value: `${stats?.onTimeRate || 0}%`,
      subtitle: "entregas pontuais",
      icon: <Clock className="h-6 w-6 text-purple-500" />,
      color: "bg-purple-500/20",
      trend: 5
    },
    {
      title: "Alertas",
      value: stats?.bottleneckTasks || 0,
      subtitle: "gargalos detectados",
      icon: <AlertTriangle className="h-6 w-6 text-amber-500" />,
      color: "bg-amber-500/20",
      pulse: (stats?.bottleneckTasks || 0) > 0
    },
    {
      title: "Lançamentos",
      value: stats?.activeLaunches || 0,
      subtitle: "em preparação",
      icon: <Rocket className="h-6 w-6 text-pink-500" />,
      color: "bg-pink-500/20"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {kpis.map((kpi, i) => (
        <KPICard key={i} {...kpi} />
      ))}
    </div>
  );
}
