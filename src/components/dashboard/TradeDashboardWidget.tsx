import { memo, useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Calendar, Camera, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";

interface TradeStats {
  totalStores: number;
  visitsThisMonth: number;
  photosThisMonth: number;
  totalInvestments: number;
}

export const TradeDashboardWidget = memo(() => {
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { isImpersonating, impersonatedUser } = useImpersonation();
  const { isAdmin } = useUserRole();
  const { t } = useLanguage();

  const effectiveUserId = isImpersonating ? impersonatedUser?.id : null;
  const shouldFilter = !isAdmin || isImpersonating;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);
        const monthStartDate = firstDayOfMonth.toISOString().split("T")[0];

        let storesQuery = supabase.from("stores").select("id", { count: "exact", head: true }).eq("status", "active");
        if (shouldFilter && effectiveUserId) {
          storesQuery = storesQuery.eq("vendedor_id", effectiveUserId);
        }
        const { count: storesCount } = await storesQuery;
        
        let visitsQuery = supabase.from("visits").select("id", { count: "exact", head: true }).gte("scheduled_date", monthStartDate);
        if (shouldFilter && effectiveUserId) {
          visitsQuery = visitsQuery.eq("user_id", effectiveUserId);
        }
        const { count: visitsCount } = await visitsQuery;
        
        let photosQuery = supabase.from("photos").select("id", { count: "exact", head: true }).gte("upload_date", monthStartDate);
        if (shouldFilter && effectiveUserId) {
          photosQuery = photosQuery.eq("vendedor_id", effectiveUserId);
        }
        const { count: photosCount } = await photosQuery;
        
        let investmentsQuery = supabase.from("trade_investments").select("amount").gte("investment_date", monthStartDate);
        if (shouldFilter && effectiveUserId) {
          investmentsQuery = investmentsQuery.eq("created_by", effectiveUserId);
        }
        const { data: investmentsData } = await investmentsQuery;

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
  }, [effectiveUserId, shouldFilter]);

  const statCards = useMemo(() => [
    {
      title: t("trade_w.active_stores"),
      value: stats?.totalStores || 0,
      icon: Store,
      description: t("trade_w.active_stores_desc"),
      format: "number" as const,
    },
    {
      title: t("trade_w.monthly_visits"),
      value: stats?.visitsThisMonth || 0,
      icon: Calendar,
      description: t("trade_w.monthly_visits_desc"),
      format: "number" as const,
    },
    {
      title: t("trade_w.monthly_photos"),
      value: stats?.photosThisMonth || 0,
      icon: Camera,
      description: t("trade_w.monthly_photos_desc"),
      format: "number" as const,
    },
    {
      title: t("trade_w.investments"),
      value: stats?.totalInvestments || 0,
      icon: DollarSign,
      description: t("trade_w.investments_desc"),
      format: "currency" as const,
    },
  ], [stats, t]);

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
