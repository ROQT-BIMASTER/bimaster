import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Building2, Sparkles, DollarSign, Factory } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MetricasDistribuicao } from "@/components/admin/MetricasDistribuicao";
import { FunilProspeccao } from "@/components/dashboard/FunilProspeccao";
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

  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  usePhotoQueueProcessor();

  const hasProspectsPermission = useMemo(() => 
    !permissionsLoading && hasModulePermission("prospects"), 
    [permissionsLoading, hasModulePermission]
  );
  
  const hasTradePermission = useMemo(() => 
    !permissionsLoading && hasModulePermission("trade"), 
    [permissionsLoading, hasModulePermission]
  );
  
  const hasFinanceiroPermission = useMemo(() => 
    !permissionsLoading && hasModulePermission("financeiro"), 
    [permissionsLoading, hasModulePermission]
  );

  useEffect(() => {
    if (permissionsLoading || !hasProspectsPermission) {
      setLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        const stages = ["novo", "em_contato", "proposta_enviada", "negociacao", "ganho"] as const;
        const stageLabels = ["Novo", "Contato", "Proposta", "Negociação", "Ganho"];
        const stageColors = [
          "hsl(217, 91%, 60%)",
          "hsl(199, 89%, 48%)",
          "hsl(173, 58%, 39%)",
          "hsl(142, 71%, 45%)",
          "hsl(120, 100%, 40%)",
        ];

        const pipelineCounts = await Promise.all(
          stages.map((stage) =>
            supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", stage),
          ),
        );

        const total = pipelineCounts.reduce((sum, result) => sum + (result.count || 0), 0);

        const pipeline = stages.map((stage, index) => ({
          stage: stageLabels[index],
          count: pipelineCounts[index].count || 0,
          percentage: total > 0 ? Math.round(((pipelineCounts[index].count || 0) / total) * 100) : 0,
          fill: stageColors[index],
        }));

        setPipelineData(pipeline);

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
          ])
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

  const ActivityTooltip = useCallback(({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{payload[0].payload.date}</p>
          <p className="text-sm">{t("dashboard.activities_label")}: {payload[0].payload.count}</p>
        </div>
      );
    }
    return null;
  }, [t]);

  const quickModulesGridClass = useMemo(() => {
    const count = quickModules.length;
    if (count === 1) return "md:grid-cols-1";
    if (count === 2) return "md:grid-cols-2";
    if (count === 3) return "md:grid-cols-3";
    return "md:grid-cols-4";
  }, [quickModules.length]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h2>
            <p className="text-muted-foreground">{t("dashboard.subtitle")}</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setChatOpen(true)}>
            <Sparkles className="h-4 w-4" />
            {t("dashboard.ai_insights")}
          </Button>
        </div>

        {effectiveIsAdmin && <MetricasDistribuicao />}

        <PushNotificationPrompt />

        {permissionsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : null}

        {hasProspectsPermission && (
          <div className="grid gap-6">

            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.activities_30d")}</CardTitle>
                <CardDescription>{t("dashboard.activities_timeline")}</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip content={ActivityTooltip} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))" }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      <AIInsightsChat open={chatOpen} onOpenChange={setChatOpen} />
    </DashboardLayout>
  );
};

export default Dashboard;
