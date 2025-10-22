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
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      // Try aggregated table first
      const { data: kpis } = await supabase
        .from('agg_daily_kpis')
        .select('*')
        .gte('date', thirtyDaysAgoStr)
        .order('date', { ascending: true });

      let formattedData: any[] = [];
      let totalSales = 0;
      let totalInvestments = 0;
      let avgTicket = 0;

      // If no aggregated data, fetch from source tables
      if (!kpis || kpis.length === 0) {
        console.log('No aggregated data, fetching from source tables...');
        
        // Fetch sales data
        const { data: salesData } = await supabase
          .from('sales')
          .select('sale_date, net_value')
          .gte('sale_date', thirtyDaysAgoStr)
          .order('sale_date', { ascending: true });

        // Fetch investments data
        const { data: investmentsData } = await supabase
          .from('trade_investments')
          .select('investment_date, amount')
          .gte('investment_date', thirtyDaysAgoStr)
          .order('investment_date', { ascending: true });

        // Fetch visits count for ticket calculation
        const { count: visitsCount } = await supabase
          .from('visits')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', thirtyDaysAgo.toISOString());

        // Create a map of dates for the last 30 days
        const dateMap: Record<string, { vendas: number; investimentos: number }> = {};
        
        for (let i = 0; i < 30; i++) {
          const date = new Date();
          date.setDate(date.getDate() - (29 - i));
          const dateStr = date.toISOString().split('T')[0];
          dateMap[dateStr] = { vendas: 0, investimentos: 0 };
        }

        // Aggregate sales by date
        salesData?.forEach(sale => {
          const dateStr = sale.sale_date;
          if (dateMap[dateStr]) {
            dateMap[dateStr].vendas += sale.net_value || 0;
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
          vendas: values.vendas,
          investimentos: values.investimentos,
          ticket: 0 // Will be calculated separately
        }));

        totalSales = salesData?.reduce((sum, sale) => sum + (sale.net_value || 0), 0) || 0;
        totalInvestments = investmentsData?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
        avgTicket = visitsCount && visitsCount > 0 ? totalSales / visitsCount : 0;

      } else {
        // Use aggregated data
        formattedData = kpis.map(kpi => ({
          date: new Date(kpi.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          vendas: kpi.total_vendas || 0,
          investimentos: kpi.total_investimentos || 0,
          ticket: kpi.media_ticket || 0
        }));

        totalSales = formattedData.reduce((acc, curr) => acc + curr.vendas, 0);
        totalInvestments = formattedData.reduce((acc, curr) => acc + curr.investimentos, 0);
        avgTicket = formattedData.reduce((acc, curr) => acc + curr.ticket, 0) / (formattedData.length || 1);
      }

      setData(formattedData);

      setSummary({
        totalSales,
        totalInvestments,
        roi: totalInvestments > 0 ? ((totalSales - totalInvestments) / totalInvestments) * 100 : 0,
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
