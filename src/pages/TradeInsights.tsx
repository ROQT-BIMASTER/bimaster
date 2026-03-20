import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Target, RefreshCw, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { TradeFilters } from "@/components/trade/TradeFilters";
import { InsightDetailDialog } from "@/components/trade/InsightDetailDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
  entity_id: string | null;
  entity_type: string | null;
  data_points: any;
}

const TradeInsights = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [allInsights, setAllInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [insightDetailOpen, setInsightDetailOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Assignment dialog state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigningInsight, setAssigningInsight] = useState<Insight | null>(null);
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [teamUsers, setTeamUsers] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
    // Load team users for assignment
    const loadTeam = async () => {
      const res = await (supabase as any).from("profiles").select("id, nome").eq("ativo", true).order("nome");
      setTeamUsers((res.data || []).map((u: any) => ({ id: u.id, nome: u.nome })));
    };
    loadTeam();
  }, []);

  useEffect(() => {
    if (!permissionsLoading && !roleLoading && isAdminOrSupervisor && currentUserId !== null) {
      fetchInsights();
    }
  }, [permissionsLoading, currentUserId, roleLoading, isAdminOrSupervisor]);

  const fetchInsights = async () => {
    try {
      // Admin/Supervisor: ver todos os insights
      const { data, error } = await supabase
        .from("ai_insights")
        .select("*")
        .order("generated_at", { ascending: false });

      if (error) throw error;
      setAllInsights(data || []);
      setInsights(data || []);
    } catch (error) {
      console.error("Erro ao buscar insights:", error);
      toast.error("Erro ao carregar insights");
    } finally {
      setLoading(false);
    }
  };

  // Bloquear acesso para não-admins/supervisores (após todos os hooks)
  if (!permissionsLoading && !roleLoading && !isAdminOrSupervisor) {
    return <Navigate to="/dashboard/acesso-restrito" replace />;
  }

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

  const applyFilters = () => {
    let filtered = [...allInsights];

    // Insights não têm store_id diretamente, mas têm entity_id e entity_type
    // Por enquanto, filtro apenas por critérios de IA
    if (aiCriteria) {
      if (aiCriteria.status) {
        filtered = filtered.filter(i => aiCriteria.status.includes(i.status));
      }
      if (aiCriteria.priority) {
        filtered = filtered.filter(i => i.priority === aiCriteria.priority);
      }
      if (aiCriteria.type) {
        filtered = filtered.filter(i => i.insight_type === aiCriteria.type);
      }
      if (aiCriteria.timeframe === "hoje") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filtered = filtered.filter(i => {
          const genDate = new Date(i.generated_at);
          genDate.setHours(0, 0, 0, 0);
          return genDate.getTime() === today.getTime();
        });
      }
      if (aiCriteria.timeframe === "semana") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(i => new Date(i.generated_at) >= weekAgo);
      }
    }

    setInsights(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [selectedStore, aiCriteria, allInsights]);

  const stats = {
    opportunities: insights.filter(i => i.insight_type === "opportunity" && i.status === "new").length,
    risks: insights.filter(i => i.insight_type === "risk" && i.status === "new").length,
    trends: insights.filter(i => i.insight_type === "trend" && i.status === "new").length,
    recommendations: insights.filter(i => i.insight_type === "recommendation" && i.status === "new").length,
  };

  if (permissionsLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Carregando permissões...</div>
      </DashboardLayout>
    );
  }

  if (!hasPermission("trade_insights")) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleAssignInsight = async () => {
    if (!assigningInsight || !assignUserId) return;
    setAssignLoading(true);
    try {
      const { error } = await supabase
        .from("ai_insights")
        .update({
          actioned_by: assignUserId,
          actioned_at: new Date().toISOString(),
          status: "actioned",
        })
        .eq("id", assigningInsight.id);
      if (error) throw error;
      toast.success("Insight atribuído com sucesso!");
      setAssignDialogOpen(false);
      setAssigningInsight(null);
      fetchInsights();
    } catch (error: any) {
      toast.error("Erro ao atribuir: " + error.message);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleGenerateInsights = async () => {
    setGenerating(true);
    toast.info("Gerando insights dos dados existentes...");

    try {
      // Buscar fotos processadas pela IA que ainda não geraram insights
      const { data: photos, error: photosError } = await supabase
        .from("photos")
        .select(`
          id,
          visit_id,
          store_id,
          photo_url,
          ai_analysis,
          our_facings,
          competitor_facings,
          upload_date
        `)
        .eq("ai_processed", true)
        .not("ai_analysis", "is", null);

      if (photosError) throw photosError;

      if (!photos || photos.length === 0) {
        toast.info("Nenhuma foto processada encontrada para gerar insights");
        return;
      }

      const insightsToCreate = [];

      for (const photo of photos) {
        const aiAnalysis = photo.ai_analysis as any;
        
        // Create general insight from AI analysis
        if (aiAnalysis?.insights) {
          insightsToCreate.push({
            title: "Análise de Gôndola - " + new Date(photo.upload_date).toLocaleDateString("pt-BR"),
            description: aiAnalysis.insights,
            insight_type: "recommendation",
            category: "shelf_analysis",
            entity_type: "visit",
            entity_id: photo.visit_id,
            priority: aiAnalysis.issues?.length > 0 ? "alta" : "media",
            impact_level: aiAnalysis.issues?.length > 0 ? "high" : "medium",
            status: "new",
            data_points: {
              photo_urls: [photo.photo_url],
              ai_analysis: aiAnalysis,
            }
          });
        }

        // Create specific insights for issues found
        if (aiAnalysis?.issues && Array.isArray(aiAnalysis.issues)) {
          aiAnalysis.issues.forEach((issue: string) => {
            insightsToCreate.push({
              title: "Problema Detectado",
              description: issue,
              insight_type: "risk",
              category: "quality_issue",
              entity_type: "visit",
              entity_id: photo.visit_id,
              priority: "alta",
              impact_level: "high",
              status: "new",
              data_points: {
                photo_urls: [photo.photo_url],
              }
            });
          });
        }

        // Create opportunity insight based on share
        const ourFacings = photo.our_facings || aiAnalysis?.our_facings || 0;
        const competitorFacings = photo.competitor_facings || aiAnalysis?.competitor_facings || 0;
        const totalFacings = ourFacings + competitorFacings;

        if (totalFacings > 0) {
          const ourShare = (ourFacings / totalFacings) * 100;
          
          if (ourShare < 50) {
            insightsToCreate.push({
              title: "Oportunidade de Crescimento de Share",
              description: `Nosso share de gôndola é ${ourShare.toFixed(1)}%. Há oportunidade para aumentar presença.`,
              insight_type: "opportunity",
              category: "shelf_share",
              entity_type: "visit",
              entity_id: photo.visit_id,
              priority: "media",
              impact_level: "medium",
              status: "new",
              confidence_score: 85,
              data_points: {
                photo_urls: [photo.photo_url],
                our_facings: ourFacings,
                competitor_facings: competitorFacings,
              }
            });
          } else if (ourShare >= 70) {
            insightsToCreate.push({
              title: "Excelente Presença de Marca",
              description: `Nosso share de gôndola é ${ourShare.toFixed(1)}%. Ótima performance!`,
              insight_type: "trend",
              category: "shelf_share",
              entity_type: "visit",
              entity_id: photo.visit_id,
              priority: "baixa",
              impact_level: "low",
              status: "new",
              confidence_score: 95,
              data_points: {
                photo_urls: [photo.photo_url],
                our_share: ourShare,
              }
            });
          }
        }
      }

      if (insightsToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from("ai_insights")
          .insert(insightsToCreate);

        if (insertError) throw insertError;

        toast.success(`✨ ${insightsToCreate.length} insights gerados com sucesso!`);
        fetchInsights();
      } else {
        toast.info("Nenhum insight novo para gerar");
      }
    } catch (error: any) {
      console.error("Erro ao gerar insights:", error);
      toast.error("Erro ao gerar insights: " + error.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <ModuleBreadcrumb 
          moduleName="Trade Marketing" 
          moduleHref="/dashboard/trade" 
          currentPage="Insights de IA" 
        />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Insights de IA</h1>
            <p className="text-muted-foreground">
              Análises e recomendações geradas por Inteligência Artificial
            </p>
          </div>
          {insights.length === 0 && (
            <Button onClick={handleGenerateInsights} disabled={generating}>
              {generating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Insights
                </>
              )}
            </Button>
          )}
        </div>

        <TradeFilters
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
        />

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
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Os insights serão gerados automaticamente conforme você adiciona dados e realiza visitas
                </p>
                <Button onClick={handleGenerateInsights} disabled={generating}>
                  {generating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Gerando Insights...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Gerar Insights de Dados Existentes
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            insights.map((insight) => (
              <Card 
                key={insight.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => {
                  setSelectedInsightId(insight.id);
                  setInsightDetailOpen(true);
                }}
              >
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
                        <Button 
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const { error } = await supabase
                                .from("ai_insights")
                                .update({ status: "reviewed", reviewed_at: new Date().toISOString(), reviewed_by: (await supabase.auth.getUser()).data.user?.id })
                                .eq("id", insight.id);
                              if (error) throw error;
                              toast.success("Insight revisado!");
                              fetchInsights();
                            } catch (error: any) {
                              toast.error("Erro ao revisar: " + error.message);
                            }
                          }}
                        >
                          Revisar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssigningInsight(insight);
                            setAssignUserId("");
                            setAssignDialogOpen(true);
                          }}
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          Atribuir
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const { error } = await supabase
                                .from("ai_insights")
                                .update({ status: "dismissed" })
                                .eq("id", insight.id);
                              if (error) throw error;
                              toast.success("Insight descartado!");
                              fetchInsights();
                            } catch (error: any) {
                              toast.error("Erro ao descartar: " + error.message);
                            }
                          }}
                        >
                          Descartar
                        </Button>
                      </div>
                      {/* Mostrar imagens relacionadas */}
                      {insight.data_points && 
                       typeof insight.data_points === 'object' && 
                       'photo_urls' in insight.data_points &&
                       Array.isArray(insight.data_points.photo_urls) && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Evidências Fotográficas:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {(insight.data_points.photo_urls as string[]).map((url: string, idx: number) => (
                              <img 
                                key={idx}
                                src={url} 
                                alt={`Evidência ${idx + 1}`}
                                className="rounded-lg w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(url, '_blank');
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <InsightDetailDialog
          insightId={selectedInsightId}
          open={insightDetailOpen}
          onOpenChange={setInsightDetailOpen}
          onUpdate={fetchInsights}
        />
        {/* Assignment Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Atribuir Insight</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {assigningInsight && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium text-sm">{assigningInsight.title}</p>
                  {assigningInsight.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {assigningInsight.description}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Atribuir para</Label>
                <Select value={assignUserId} onValueChange={setAssignUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAssignInsight} disabled={!assignUserId || assignLoading}>
                {assignLoading ? "Atribuindo..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default TradeInsights;
