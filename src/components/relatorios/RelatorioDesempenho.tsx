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
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      // Try aggregated table first
      const { data: kpis } = await supabase
        .from('agg_daily_kpis')
        .select('*')
        .gte('date', thirtyDaysAgoStr)
        .order('date', { ascending: true });

      let formattedData: any[] = [];

      // If no aggregated data, fetch from source tables
      if (!kpis || kpis.length === 0) {
        console.log('No aggregated data, fetching from source tables...');
        
        // Fetch visits data
        const { data: visitsData } = await supabase
          .from('visits')
          .select('created_at')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true });

        // Fetch activities data
        const { data: atividadesData } = await supabase
          .from('atividades')
          .select('data_atividade')
          .gte('data_atividade', thirtyDaysAgo.toISOString())
          .order('data_atividade', { ascending: true });

        // Fetch prospects data
        const { data: prospectsData } = await supabase
          .from('prospects')
          .select('created_at')
          .eq('status', 'ganho')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true });

        // Fetch investments data
        const { data: investmentsData } = await supabase
          .from('trade_investments')
          .select('investment_date, amount')
          .gte('investment_date', thirtyDaysAgoStr)
          .order('investment_date', { ascending: true });

        // Create a map of dates for the last 30 days
        const dateMap: Record<string, { visitas: number; atividades: number; conversoes: number; investimentos: number }> = {};
        
        for (let i = 0; i < 30; i++) {
          const date = new Date();
          date.setDate(date.getDate() - (29 - i));
          const dateStr = date.toISOString().split('T')[0];
          dateMap[dateStr] = { visitas: 0, atividades: 0, conversoes: 0, investimentos: 0 };
        }

        // Aggregate visits by date
        visitsData?.forEach(visit => {
          const dateStr = new Date(visit.created_at).toISOString().split('T')[0];
          if (dateMap[dateStr]) {
            dateMap[dateStr].visitas++;
          }
        });

        // Aggregate activities by date
        atividadesData?.forEach(atividade => {
          const dateStr = new Date(atividade.data_atividade).toISOString().split('T')[0];
          if (dateMap[dateStr]) {
            dateMap[dateStr].atividades++;
          }
        });

        // Aggregate conversions by date
        prospectsData?.forEach(prospect => {
          const dateStr = new Date(prospect.created_at).toISOString().split('T')[0];
          if (dateMap[dateStr]) {
            dateMap[dateStr].conversoes++;
          }
        });

        // Aggregate investments by date
        investmentsData?.forEach(inv => {
          const dateStr = inv.investment_date;
          if (dateMap[dateStr]) {
            dateMap[dateStr].investimentos += inv.amount || 0;
          }
        });

        // Format data for chart
        formattedData = Object.entries(dateMap).map(([date, values]) => ({
          date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          visitas: values.visitas,
          atividades: values.atividades,
          conversoes: values.conversoes,
          investimentos: values.investimentos
        }));

      } else {
        // Use aggregated data
        formattedData = kpis.map(kpi => ({
          date: new Date(kpi.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          visitas: kpi.total_visitas || 0,
          atividades: kpi.total_atividades || 0,
          conversoes: kpi.prospects_convertidos || 0,
          investimentos: kpi.total_investimentos || 0
        }));
      }

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
