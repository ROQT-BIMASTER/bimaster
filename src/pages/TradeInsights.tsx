import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";

interface Insight {
  id: string;
  insight_type: string;
  category: string;
  title: string;
  description: string | null;
  confidence_score: number | null;
  impact_level: string | null;
  priority: string | null;
  status: string;
  generated_at: string;
}

const TradeInsights = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  if (!permissionsLoading && !hasPermission("trade_insights")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("*")
        .order("generated_at", { ascending: false });

      if (error) throw error;
      setInsights(data || []);
    } catch (error) {
      console.error("Erro ao buscar insights:", error);
      toast.error("Erro ao carregar insights");
    } finally {
      setLoading(false);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "opportunity":
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case "risk":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case "trend":
        return <Target className="h-5 w-5 text-blue-600" />;
      case "recommendation":
        return <Lightbulb className="h-5 w-5 text-yellow-600" />;
      default:
        return <Sparkles className="h-5 w-5" />;
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      opportunity: "Oportunidade",
      risk: "Risco",
      trend: "Tendência",
      recommendation: "Recomendação",
      alert: "Alerta",
    };
    return labels[type] || type;
  };

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "urgente":
        return "destructive";
      case "alta":
        return "default";
      case "media":
        return "secondary";
      case "baixa":
        return "outline";
      default:
        return "outline";
    }
  };

  const stats = {
    opportunities: insights.filter(i => i.insight_type === "opportunity" && i.status === "new").length,
    risks: insights.filter(i => i.insight_type === "risk" && i.status === "new").length,
    trends: insights.filter(i => i.insight_type === "trend" && i.status === "new").length,
    recommendations: insights.filter(i => i.insight_type === "recommendation" && i.status === "new").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Insights de IA</h1>
          <p className="text-muted-foreground">
            Análises e recomendações geradas por Inteligência Artificial
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Oportunidades</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.opportunities}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Riscos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.risks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tendências</CardTitle>
              <Target className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.trends}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recomendações</CardTitle>
              <Lightbulb className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.recommendations}</div>
            </CardContent>
          </Card>
        </div>

        {/* Insights List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-6 text-center">
                Carregando insights...
              </CardContent>
            </Card>
          ) : insights.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum insight gerado ainda</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  Os insights serão gerados automaticamente conforme você adiciona dados e realiza visitas
                </p>
              </CardContent>
            </Card>
          ) : (
            insights.map((insight) => (
              <Card key={insight.id}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">{getInsightIcon(insight.insight_type)}</div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-lg mb-1">{insight.title}</h3>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{getTypeLabel(insight.insight_type)}</Badge>
                            {insight.category && (
                              <Badge variant="secondary">{insight.category}</Badge>
                            )}
                            {insight.priority && (
                              <Badge variant={getPriorityColor(insight.priority)}>
                                {insight.priority}
                              </Badge>
                            )}
                            {insight.confidence_score && (
                              <span className="text-xs text-muted-foreground">
                                Confiança: {insight.confidence_score}%
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant={insight.status === "new" ? "default" : "outline"}>
                          {insight.status === "new" ? "Novo" : insight.status}
                        </Badge>
                      </div>
                      {insight.description && (
                        <p className="text-muted-foreground mb-4">{insight.description}</p>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm">Revisar</Button>
                        <Button size="sm" variant="outline">
                          Atribuir
                        </Button>
                        <Button size="sm" variant="ghost">
                          Descartar
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TradeInsights;
