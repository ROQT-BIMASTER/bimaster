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
import { usePermissions } from "@/contexts/PermissionsContext";
import { Skeleton } from "@/components/ui/skeleton";

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
  // Usar contexto centralizado de permissões
  const { hasModulePermission, isAdmin, loading: permissionsLoading } = usePermissions();
  const [pipelineData, setPipelineData] = useState<PipelineData[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  // Memoizar verificação de permissões para evitar recálculos
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

  // Carregar dados do pipeline e atividades - otimizado com query agregada
  useEffect(() => {
    if (permissionsLoading || !hasProspectsPermission) {
      setLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        // Fetch pipeline data
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

        // Fetch activity data usando função agregada (1 query em vez de 30)
        const startDate = format(subDays(new Date(), 29), "yyyy-MM-dd");
        const endDate = format(new Date(), "yyyy-MM-dd");
        
        const { data: activityCounts } = await supabase.rpc("get_activity_counts_by_date", {
          p_start_date: startDate,
          p_end_date: endDate,
        });

        // Criar mapa de contagens
        const countsMap = new Map(
          (activityCounts || []).map((item: { activity_date: string; activity_count: number }) => [
            item.activity_date,
            Number(item.activity_count),
          ])
        );

        // Gerar array com todos os 30 dias
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

  // Memoizar módulos rápidos
  const quickModules = useMemo(() => {
    if (permissionsLoading) return [];
    
    return [
      {
        moduleCode: "prospects",
        title: "Módulo de Prospects",
        description: "Gestão completa de prospects e pipeline",
        icon: Users,
        link: "/dashboard/prospects",
      },
      {
        moduleCode: "trade",
        title: "Módulo de Trade Marketing",
        description: "Monitoramento de PDVs e performance",
        icon: Building2,
        link: "/dashboard/trade",
      },
      {
        moduleCode: "financeiro",
        title: "Módulo Financeiro",
        description: "Gestão de contas e fluxo de caixa",
        icon: DollarSign,
        link: "/dashboard/financeiro",
      },
      {
        moduleCode: "fabrica",
        title: "Módulo Fábrica",
        description: "Produção, fórmulas e qualidade",
        icon: Factory,
        link: "/dashboard/fabrica",
      },
    ].filter((mod) => hasModulePermission(mod.moduleCode));
  }, [permissionsLoading, hasModulePermission]);

  // Memoizar tooltip do gráfico
  const ActivityTooltip = useCallback(({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{payload[0].payload.date}</p>
          <p className="text-sm">Atividades: {payload[0].payload.count}</p>
        </div>
      );
    }
    return null;
  }, []);

  // Memoizar grid class
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
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground">Visão geral do seu CRM</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setChatOpen(true)}>
            <Sparkles className="h-4 w-4" />
            Insights de IA
          </Button>
        </div>

        {isAdmin && <MetricasDistribuicao />}

        {/* Widgets condicionais por módulo */}
        {permissionsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Widget de Prospects - apenas se tiver permissão */}
            {hasProspectsPermission && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Prospects</h3>
                <ProspectsDashboardWidget />
              </div>
            )}

            {/* Widget de Trade - apenas se tiver permissão */}
            {hasTradePermission && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Trade Marketing</h3>
                <TradeDashboardWidget />
              </div>
            )}

            {/* Widget Financeiro - apenas se tiver permissão */}
            {hasFinanceiroPermission && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Financeiro</h3>
                <FinanceiroDashboardWidget />
              </div>
            )}
          </div>
        )}

        {/* Pipeline e Atividades - apenas se tiver módulo de prospects */}
        {hasProspectsPermission && (
          <div className="grid gap-6">
            <FunilProspeccao data={pipelineData} />

            <Card>
              <CardHeader>
                <CardTitle>Atividades - Últimos 30 Dias</CardTitle>
                <CardDescription>Linha do tempo de atividades registradas</CardDescription>
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

        {/* Módulos Rápidos - apenas os que tem permissão */}
        {quickModules.length > 0 && (
          <div className={`grid gap-4 ${quickModulesGridClass}`}>
            {quickModules.map((mod) => (
              <Card key={mod.moduleCode} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <mod.icon className="h-5 w-5" />
                    {mod.title}
                  </CardTitle>
                  <CardDescription>{mod.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link to={mod.link}>Acessar Módulo</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AIInsightsChat open={chatOpen} onOpenChange={setChatOpen} />
    </DashboardLayout>
  );
};

export default Dashboard;
