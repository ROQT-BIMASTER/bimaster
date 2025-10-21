import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { ExportControls } from "./ExportControls";
import { Skeleton } from "@/components/ui/skeleton";

export const RelatorioDesempenho = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: kpis } = await supabase
        .from('agg_daily_kpis')
        .select('*')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      const formattedData = kpis?.map(kpi => ({
        date: new Date(kpi.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        visitas: kpi.total_visitas,
        atividades: kpi.total_atividades,
        conversoes: kpi.prospects_convertidos,
        investimentos: kpi.total_investimentos
      })) || [];

      setData(formattedData);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Relatório de Desempenho</CardTitle>
              <CardDescription>Análise de visitas, atividades e conversões</CardDescription>
            </div>
            <ExportControls reportType="desempenho" data={data} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-medium mb-4">Visitas e Atividades (Últimos 30 dias)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="visitas" fill="hsl(var(--primary))" name="Visitas" />
                  <Bar dataKey="atividades" fill="hsl(var(--secondary))" name="Atividades" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-4">Taxa de Conversão</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="conversoes" 
                    stroke="hsl(var(--primary))" 
                    name="Conversões"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
