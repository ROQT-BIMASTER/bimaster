import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, Target, DollarSign, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface KPIData {
  totalProspects: number;
  totalVisits: number;
  totalInvestments: number;
  conversionRate: number;
  avgTicket: number;
  activeGoals: number;
  prospectsTrend: number;
  visitsTrend: number;
  investmentsTrend: number;
}

export const ExecutiveKPIs = () => {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKPIs();
  }, []);

  const fetchKPIs = async () => {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

      // Try aggregated table first
      const { data: currentKPIs } = await supabase
        .from('agg_daily_kpis')
        .select('*')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

      const { data: previousKPIs } = await supabase
        .from('agg_daily_kpis')
        .select('*')
        .gte('date', sixtyDaysAgo.toISOString().split('T')[0])
        .lt('date', thirtyDaysAgo.toISOString().split('T')[0]);

      let currentTotal = { visits: 0, investments: 0, prospects: 0, activities: 0, sales: 0 };
      let previousTotal = { visits: 0, investments: 0, prospects: 0 };

      // If no aggregated data, fetch directly from source tables
      if (!currentKPIs || currentKPIs.length === 0) {
        console.log('No aggregated data, fetching from source tables...');
        
        // Fetch current period data
        const [visitsResult, investmentsResult, salesResult, prospectsResult] = await Promise.all([
          supabase.from('visits').select('*', { count: 'exact', head: true })
            .gte('created_at', thirtyDaysAgo.toISOString()),
          supabase.from('trade_investments').select('amount')
            .gte('investment_date', thirtyDaysAgo.toISOString().split('T')[0]),
          supabase.from('sales').select('net_value')
            .gte('sale_date', thirtyDaysAgo.toISOString().split('T')[0]),
          supabase.from('prospects').select('*', { count: 'exact', head: true })
            .eq('status', 'ganho')
            .gte('created_at', thirtyDaysAgo.toISOString())
        ]);

        // Fetch previous period data for trends
        const [prevVisitsResult, prevInvestmentsResult, prevProspectsResult] = await Promise.all([
          supabase.from('visits').select('*', { count: 'exact', head: true })
            .gte('created_at', sixtyDaysAgo.toISOString())
            .lt('created_at', thirtyDaysAgo.toISOString()),
          supabase.from('trade_investments').select('amount')
            .gte('investment_date', sixtyDaysAgo.toISOString().split('T')[0])
            .lt('investment_date', thirtyDaysAgo.toISOString().split('T')[0]),
          supabase.from('prospects').select('*', { count: 'exact', head: true })
            .eq('status', 'ganho')
            .gte('created_at', sixtyDaysAgo.toISOString())
            .lt('created_at', thirtyDaysAgo.toISOString())
        ]);

        currentTotal = {
          visits: visitsResult.count || 0,
          investments: investmentsResult.data?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0,
          sales: salesResult.data?.reduce((sum, sale) => sum + (sale.net_value || 0), 0) || 0,
          prospects: prospectsResult.count || 0,
          activities: 0
        };

        previousTotal = {
          visits: prevVisitsResult.count || 0,
          investments: prevInvestmentsResult.data?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0,
          prospects: prevProspectsResult.count || 0
        };
      } else {
        // Use aggregated data
        currentTotal = currentKPIs.reduce((acc, kpi) => ({
          visits: acc.visits + (kpi.total_visitas || 0),
          investments: acc.investments + (kpi.total_investimentos || 0),
          prospects: acc.prospects + (kpi.prospects_convertidos || 0),
          activities: acc.activities + (kpi.total_atividades || 0),
          sales: acc.sales + (kpi.total_vendas || 0)
        }), { visits: 0, investments: 0, prospects: 0, activities: 0, sales: 0 });

        previousTotal = previousKPIs?.reduce((acc, kpi) => ({
          visits: acc.visits + (kpi.total_visitas || 0),
          investments: acc.investments + (kpi.total_investimentos || 0),
          prospects: acc.prospects + (kpi.prospects_convertidos || 0)
        }), { visits: 0, investments: 0, prospects: 0 }) || 
        { visits: 0, investments: 0, prospects: 0 };
      }

      // Active goals
      const { data: goals } = await supabase
        .from('goals')
        .select('*')
        .eq('status', 'active');

      // Total prospects
      const { count: totalProspects } = await supabase
        .from('prospects')
        .select('*', { count: 'exact', head: true });

      const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      setKpis({
        totalProspects: totalProspects || 0,
        totalVisits: currentTotal.visits,
        totalInvestments: currentTotal.investments,
        conversionRate: currentTotal.prospects > 0 && totalProspects 
          ? (currentTotal.prospects / totalProspects) * 100 
          : 0,
        avgTicket: currentTotal.visits > 0 
          ? currentTotal.sales / currentTotal.visits 
          : 0,
        activeGoals: goals?.length || 0,
        prospectsTrend: calculateTrend(currentTotal.prospects, previousTotal.prospects),
        visitsTrend: calculateTrend(currentTotal.visits, previousTotal.visits),
        investmentsTrend: calculateTrend(currentTotal.investments, previousTotal.investments)
      });
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
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

  const kpiCards = [
    {
      title: "Total de Prospects",
      value: kpis?.totalProspects.toLocaleString('pt-BR'),
      trend: kpis?.prospectsTrend,
      icon: Users,
      color: "text-blue-600"
    },
    {
      title: "Visitas (30 dias)",
      value: kpis?.totalVisits.toLocaleString('pt-BR'),
      trend: kpis?.visitsTrend,
      icon: Activity,
      color: "text-green-600"
    },
    {
      title: "Taxa de Conversão",
      value: `${(kpis?.conversionRate || 0).toFixed(1)}%`,
      icon: Target,
      color: "text-orange-600"
    },
    {
      title: "Ticket Médio",
      value: `R$ ${(kpis?.avgTicket || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-cyan-600"
    },
    {
      title: "Metas Ativas",
      value: kpis?.activeGoals.toString(),
      icon: Target,
      color: "text-red-600"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {kpiCards.map((kpi, index) => {
        const Icon = kpi.icon;
        const showTrend = kpi.trend !== undefined;
        const isPositive = (kpi.trend || 0) >= 0;

        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              {showTrend && (
                <div className={`flex items-center text-xs mt-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                  {Math.abs(kpi.trend!).toFixed(1)}% vs período anterior
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
