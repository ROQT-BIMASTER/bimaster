import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ExportControls } from "./ExportControls";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export const RelatorioFinanceiro = () => {
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
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
        vendas: kpi.total_vendas,
        investimentos: kpi.total_investimentos,
        ticket: kpi.media_ticket
      })) || [];

      setData(formattedData);

      const totalSales = formattedData.reduce((acc, curr) => acc + curr.vendas, 0);
      const totalInvestments = formattedData.reduce((acc, curr) => acc + curr.investimentos, 0);
      const avgTicket = formattedData.reduce((acc, curr) => acc + curr.ticket, 0) / (formattedData.length || 1);

      setSummary({
        totalSales,
        totalInvestments,
        roi: totalSales > 0 ? ((totalSales - totalInvestments) / totalInvestments) * 100 : 0,
        avgTicket
      });
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                R$ {(summary?.totalSales || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Investido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                R$ {(summary?.totalInvestments || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <Wallet className="h-4 w-4 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ROI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {(summary?.roi || 0).toFixed(1)}%
              </div>
              {(summary?.roi || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                R$ {(summary?.avgTicket || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <DollarSign className="h-4 w-4 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Relatório Financeiro</CardTitle>
              <CardDescription>Análise de vendas e investimentos</CardDescription>
            </div>
            <ExportControls reportType="financeiro" data={data} />
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorInvestimentos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="vendas" 
                stroke="hsl(var(--primary))" 
                fillOpacity={1} 
                fill="url(#colorVendas)" 
                name="Vendas"
              />
              <Area 
                type="monotone" 
                dataKey="investimentos" 
                stroke="hsl(var(--secondary))" 
                fillOpacity={1} 
                fill="url(#colorInvestimentos)" 
                name="Investimentos"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
