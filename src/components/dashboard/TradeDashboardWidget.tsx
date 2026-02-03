import { memo, useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Calendar, Camera, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface TradeStats {
  totalStores: number;
  visitsThisMonth: number;
  photosThisMonth: number;
  totalInvestments: number;
}

export const TradeDashboardWidget = memo(() => {
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);
        const monthStart = firstDayOfMonth.toISOString();
        const monthStartDate = firstDayOfMonth.toISOString().split("T")[0];

        // Buscar contagem de stores (usa status='active', não coluna active)
        const storesQuery = supabase.from("stores").select("id", { count: "exact", head: true });
        const { count: storesCount } = await (storesQuery as any).eq("status", "active");
        
        // Buscar contagem de visitas
        const visitsQuery = supabase.from("visits").select("id", { count: "exact", head: true });
        const { count: visitsCount } = await (visitsQuery as any).gte("scheduled_date", monthStartDate);
        
        // Buscar contagem de fotos (usa upload_date, não created_at)
        const photosQuery = supabase.from("photos").select("id", { count: "exact", head: true });
        const { count: photosCount } = await (photosQuery as any).gte("upload_date", monthStartDate);
        
        // Buscar investimentos
        const investmentsQuery = supabase.from("trade_investments").select("amount");
        const { data: investmentsData } = await (investmentsQuery as any).gte("investment_date", monthStartDate);

        const totalInv = (investmentsData as Array<{ amount: number | null }> | null)?.reduce(
          (sum: number, inv: { amount: number | null }) => sum + (inv.amount || 0), 
          0
        ) || 0;

        setStats({
          totalStores: storesCount || 0,
          visitsThisMonth: visitsCount || 0,
          photosThisMonth: photosCount || 0,
          totalInvestments: totalInv,
        });
      } catch (error) {
        console.error("Erro ao carregar stats de trade:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = useMemo(() => [
    {
      title: "PDVs Ativos",
      value: stats?.totalStores || 0,
      icon: Store,
      description: "Pontos de venda",
      format: "number" as const,
    },
    {
      title: "Visitas do Mês",
      value: stats?.visitsThisMonth || 0,
      icon: Calendar,
      description: "Visitas realizadas",
      format: "number" as const,
    },
    {
      title: "Fotos do Mês",
      value: stats?.photosThisMonth || 0,
      icon: Camera,
      description: "Fotos enviadas",
      format: "number" as const,
    },
    {
      title: "Investimentos",
      value: stats?.totalInvestments || 0,
      icon: DollarSign,
      description: "Total do mês",
      format: "currency" as const,
    },
  ], [stats]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
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
    <div className="grid gap-4 md:grid-cols-4">
      {statCards.map((stat, index) => (
        <Card key={index} className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stat.format === "currency"
                ? `R$ ${stat.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                : stat.value.toLocaleString("pt-BR")}
            </div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

TradeDashboardWidget.displayName = "TradeDashboardWidget";
