import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  MapPin
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonitoringPanelProps {
  userId?: string;
}

interface KPIs {
  totalVisits: number;
  completedVisits: number;
  scheduledVisits: number;
  inProgressVisits: number;
  cancelledVisits: number;
  completionRate: number;
  weekVisits: number;
  monthVisits: number;
  todayVisits: number;
}

export const VisitsMonitoringPanel = ({ userId }: MonitoringPanelProps) => {
  const [kpis, setKpis] = useState<KPIs>({
    totalVisits: 0,
    completedVisits: 0,
    scheduledVisits: 0,
    inProgressVisits: 0,
    cancelledVisits: 0,
    completionRate: 0,
    weekVisits: 0,
    monthVisits: 0,
    todayVisits: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKPIs();
  }, [userId]);

  const fetchKPIs = async () => {
    try {
      setLoading(true);
      
      let query = supabase.from("visits").select("*");
      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data: visits, error } = await query;
      if (error) throw error;

      const now = new Date();
      const today = format(now, "yyyy-MM-dd");
      const weekStart = format(startOfWeek(now, { locale: ptBR }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(now, { locale: ptBR }), "yyyy-MM-dd");
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

      const completed = visits?.filter(v => v.status === "completed") || [];
      const scheduled = visits?.filter(v => v.status === "scheduled") || [];
      const inProgress = visits?.filter(v => v.status === "in_progress") || [];
      const cancelled = visits?.filter(v => v.status === "cancelled") || [];
      
      const weekVisits = visits?.filter(v => 
        v.scheduled_date >= weekStart && v.scheduled_date <= weekEnd
      ) || [];
      
      const monthVisits = visits?.filter(v => 
        v.scheduled_date >= monthStart && v.scheduled_date <= monthEnd
      ) || [];
      
      const todayVisits = visits?.filter(v => v.scheduled_date === today) || [];

      const total = visits?.length || 0;
      const completionRate = total > 0 ? (completed.length / total) * 100 : 0;

      setKpis({
        totalVisits: total,
        completedVisits: completed.length,
        scheduledVisits: scheduled.length,
        inProgressVisits: inProgress.length,
        cancelledVisits: cancelled.length,
        completionRate,
        weekVisits: weekVisits.length,
        monthVisits: monthVisits.length,
        todayVisits: todayVisits.length,
      });
    } catch (error) {
      console.error("Erro ao buscar KPIs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Carregando dados...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Painel de Monitoramento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Taxa de Conclusão */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Taxa de Conclusão</span>
                <span className="text-sm font-bold">{kpis.completionRate.toFixed(1)}%</span>
              </div>
              <Progress value={kpis.completionRate} className="h-2" />
            </div>

            {/* Grid de Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Hoje</span>
                </div>
                <p className="text-2xl font-bold">{kpis.todayVisits}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Esta Semana</span>
                </div>
                <p className="text-2xl font-bold">{kpis.weekVisits}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Concluídas</span>
                </div>
                <p className="text-2xl font-bold">{kpis.completedVisits}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Em Andamento</span>
                </div>
                <p className="text-2xl font-bold">{kpis.inProgressVisits}</p>
              </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Agendadas</span>
                <Badge variant="default">{kpis.scheduledVisits}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Canceladas</span>
                <Badge variant="destructive">{kpis.cancelledVisits}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
