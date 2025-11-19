import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PerformanceData {
  date: string;
  points: number;
  visits: number;
  audits: number;
}

export const PerformanceEvolutionChart = () => {
  const [data, setData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const fetchPerformanceData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar pontos dos últimos 30 dias
      const thirtyDaysAgo = subDays(new Date(), 30);
      
      const { data: pointsData, error: pointsError } = await supabase
        .from("user_points_history")
        .select("earned_at, final_points, action_code")
        .eq("user_id", user.id)
        .gte("earned_at", thirtyDaysAgo.toISOString())
        .order("earned_at", { ascending: true });

      if (pointsError) throw pointsError;

      // Agregar dados por dia
      const dailyData: { [key: string]: PerformanceData } = {};
      
      pointsData?.forEach((point) => {
        const date = format(new Date(point.earned_at), "dd/MM");
        
        if (!dailyData[date]) {
          dailyData[date] = {
            date,
            points: 0,
            visits: 0,
            audits: 0,
          };
        }
        
        dailyData[date].points += point.final_points;
        
        if (point.action_code?.includes('visit')) {
          dailyData[date].visits += 1;
        }
        if (point.action_code?.includes('audit')) {
          dailyData[date].audits += 1;
        }
      });

      const chartData = Object.values(dailyData);
      setData(chartData);
    } catch (error) {
      console.error("Erro ao buscar dados de performance:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução de Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Carregando dados...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Evolução de Performance
        </CardTitle>
        <CardDescription>Últimos 30 dias de atividade</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Sem dados de performance ainda
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="points" 
                name="Pontos"
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
              <Line 
                type="monotone" 
                dataKey="visits" 
                name="Visitas"
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-2))' }}
              />
              <Line 
                type="monotone" 
                dataKey="audits" 
                name="Auditorias"
                stroke="hsl(var(--chart-3))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--chart-3))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
