import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Users, Building2, Sparkles, DollarSign, Factory,
  LayoutDashboard, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MetricasDistribuicao } from "@/components/admin/MetricasDistribuicao";
import { AIInsightsChat } from "@/components/chat/AIInsightsChat";
import { ProspectsDashboardWidget } from "@/components/dashboard/ProspectsDashboardWidget";
import { TradeDashboardWidget } from "@/components/dashboard/TradeDashboardWidget";
import { FinanceiroDashboardWidget } from "@/components/dashboard/FinanceiroDashboardWidget";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Skeleton } from "@/components/ui/skeleton";
import { PushNotificationPrompt } from "@/components/pwa/PushNotificationPrompt";
import { usePhotoQueueProcessor } from "@/hooks/usePhotoQueueProcessor";
import { useLanguage } from "@/contexts/LanguageContext";
import { chartColors } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";

interface PipelineData {
  stage: string;
  count: number;
  percentage: number;
  fill: string;
}

interface ActivityData {
  date: string;
  count: number;
}

const moduleIcons: Record<string, { icon: typeof Users; gradient: string }> = {
  prospects:  { icon: Users,     gradient: "from-primary/10 to-primary/5" },
  trade:      { icon: Building2, gradient: "from-warning/10 to-warning/5" },
  financeiro: { icon: DollarSign, gradient: "from-success/10 to-success/5" },
  fabrica:    { icon: Factory,   gradient: "from-accent/10 to-accent/5" },
};

const Dashboard = () => {
  const { hasModulePermission, loading: permissionsLoading } = useModulePermissions();
  const { isAdmin: realIsAdmin } = usePermissions();
  const { isImpersonating, impersonatedPermissions } = useImpersonation();
  const { t } = useLanguage();

  const effectiveIsAdmin = useMemo(() => {
    if (isImpersonating && impersonatedPermissions) {
      return impersonatedPermissions.isAdmin;
    }
    return realIsAdmin;
  }, [isImpersonating, impersonatedPermissions, realIsAdmin]);

  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  usePhotoQueueProcessor();

  const hasProspectsPermission = useMemo(
    () => !permissionsLoading && hasModulePermission("prospects"),
    [permissionsLoading, hasModulePermission],
  );
  const hasTradePermission = useMemo(
    () => !permissionsLoading && hasModulePermission("trade"),
    [permissionsLoading, hasModulePermission],
  );
  const hasFinanceiroPermission = useMemo(
    () => !permissionsLoading && hasModulePermission("financeiro"),
    [permissionsLoading, hasModulePermission],
  );

  useEffect(() => {
    if (permissionsLoading || !hasProspectsPermission) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const startDate = format(subDays(new Date(), 29), "yyyy-MM-dd");
        const endDate = format(new Date(), "yyyy-MM-dd");

        const { data: activityCounts } = await supabase.rpc("get_activity_counts_by_date", {
          p_start_date: startDate,
          p_end_date: endDate,
        });

        const countsMap = new Map(
          (activityCounts || []).map((item: { activity_date: string; activity_count: number }) => [
            item.activity_date,
            Number(item.activity_count),
          ]),
        );

        const activities = Array.from({ length: 30 }, (_, i) => {
          const date = subDays(new Date(), 29 - i);
          const dateStr = format(date, "yyyy-MM-dd");
          return {
            date: format(date, "dd/MM", { locale: ptBR }),
            count: countsMap.get(dateStr) || 0,
          };
        });

        setActivityData(activities);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [permissionsLoading, hasProspectsPermission]);

  const quickModules = useMemo(() => {
    if (permissionsLoading) return [];

    return [
      {
        moduleCode: "prospects",
        title: t("quick.prospects"),
        description: t("quick.prospects_desc"),
        icon: Users,
        link: "/dashboard/prospects",
      },
      {
        moduleCode: "trade",
        title: t("quick.trade"),
        description: t("quick.trade_desc"),
        icon: Building2,
        link: "/dashboard/trade",
      },
      {
        moduleCode: "financeiro",
        title: t("quick.financeiro"),
        description: t("quick.financeiro_desc"),
        icon: DollarSign,
        link: "/dashboard/financeiro",
      },
      {
        moduleCode: "fabrica",
        title: t("quick.fabrica"),
        description: t("quick.fabrica_desc"),
        icon: Factory,
        link: "/dashboard/fabrica",
      },
    ].filter((mod) => hasModulePermission(mod.moduleCode));
  }, [permissionsLoading, hasModulePermission, t]);

  const ActivityTooltip = useCallback(
    ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-card border rounded-lg p-3 shadow-lg">
            <p className="font-semibold">{payload[0].payload.date}</p>
            <p className="text-sm">
              {t("dashboard.activities_label")}: {payload[0].payload.count}
            </p>
          </div>
        );
      }
      return null;
    },
    [t],
  );

  const quickModulesGridClass = useMemo(() => {
    const count = quickModules.length;
    if (count === 1) return "md:grid-cols-1";
    if (count === 2) return "md:grid-cols-2";
    if (count === 3) return "md:grid-cols-3";
    return "md:grid-cols-2 lg:grid-cols-4";
  }, [quickModules.length]);

  // Greeting based on time
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <PageHeader
          icon={LayoutDashboard}
          title={`${greeting}!`}
          description={t("dashboard.subtitle")}
          actions={
            <Button variant="outline" className="gap-2" onClick={() => setChatOpen(true)}>
              <Sparkles className="h-4 w-4" />
              {t("dashboard.ai_insights")}
            </Button>
          }
        />

        {effectiveIsAdmin && <MetricasDistribuicao />}

        <PushNotificationPrompt />

        {permissionsLoading && (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <KpiCard key={i} title="" value="" loading />
            ))}
          </div>
        )}

        {/* Quick Access Modules */}
        {!permissionsLoading && quickModules.length > 0 && (
          <div className={cn("grid gap-4", quickModulesGridClass)}>
            {quickModules.map((mod, i) => {
              const config = moduleIcons[mod.moduleCode] || moduleIcons.prospects;
              const ModIcon = mod.icon;
              return (
                <Link key={mod.moduleCode} to={mod.link} className="group">
                  <Card
                    className={cn(
                      "h-full border transition-all duration-200 hover:shadow-soft-lg hover:-translate-y-0.5 cursor-pointer",
                    )}
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className={cn("p-2.5 rounded-xl bg-gradient-to-br", config.gradient)}>
                          <ModIcon className="h-5 w-5 text-foreground" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="mt-3">
                        <h3 className="font-semibold text-foreground">{mod.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {mod.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Module Widgets */}
        {hasProspectsPermission && <ProspectsDashboardWidget />}
        {hasTradePermission && <TradeDashboardWidget />}
        {hasFinanceiroPermission && <FinanceiroDashboardWidget />}

        {/* Activity Chart */}
        {hasProspectsPermission && (
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.activities_30d")}</CardTitle>
              <CardDescription>{t("dashboard.activities_timeline")}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={ActivityTooltip} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={chartColors.primary}
                      strokeWidth={2}
                      fill="url(#activityGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: chartColors.primary, strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AIInsightsChat open={chatOpen} onOpenChange={setChatOpen} />
    </DashboardLayout>
  );
};

export default Dashboard;
