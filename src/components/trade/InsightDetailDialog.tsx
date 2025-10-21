import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Target,
  Store,
  MapPin,
  Calendar,
  ImageIcon,
  Briefcase,
  User,
  CheckCircle2,
  XCircle,
  BarChart3,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InsightDetailDialogProps {
  insightId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function InsightDetailDialog({ insightId, open, onOpenChange, onUpdate }: InsightDetailDialogProps) {
  const [loading, setLoading] = useState(true);
  const [insightData, setInsightData] = useState<any>(null);
  const [entityData, setEntityData] = useState<any>(null);
  const [storeData, setStoreData] = useState<any>(null);
  const [visitData, setVisitData] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);

  useEffect(() => {
    if (insightId && open) {
      fetchInsightDetails();
    }
  }, [insightId, open]);

  const fetchInsightDetails = async () => {
    if (!insightId) return;

    try {
      setLoading(true);

      // Buscar insight
      const { data: insight, error: insightError } = await supabase
        .from("ai_insights")
        .select("*")
        .eq("id", insightId)
        .maybeSingle();

      if (insightError) throw insightError;
      if (!insight) {
        toast.error("Insight não encontrado");
        setLoading(false);
        return;
      }

      setInsightData(insight);

      // Buscar dados da entidade relacionada
      if (insight.entity_id && insight.entity_type) {
        if (insight.entity_type === "visit") {
          const { data: visit } = await supabase
            .from("visits")
            .select("*")
            .eq("id", insight.entity_id)
            .maybeSingle();

          setVisitData(visit);

          // Buscar promotor
          if (visit?.user_id) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("nome, email")
              .eq("id", visit.user_id)
              .maybeSingle();

            if (profile) {
              (visit as any).user = profile;
              setVisitData({ ...visit, user: profile });
            }
          }

          // Buscar loja da visita
          if (visit?.store_id) {
            const { data: store } = await supabase
              .from("stores")
              .select("*")
              .eq("id", visit.store_id)
              .maybeSingle();

            setStoreData(store);
          }

          // Buscar fotos da visita
          const { data: visitPhotos } = await supabase
            .from("photos")
            .select("*")
            .eq("visit_id", insight.entity_id)
            .limit(20);

          setPhotos(visitPhotos || []);
        } else if (insight.entity_type === "store") {
          const { data: store } = await supabase
            .from("stores")
            .select("*")
            .eq("id", insight.entity_id)
            .maybeSingle();

          setStoreData(store);
          setEntityData(store);
        }
      }

      // Buscar fotos dos data_points se houver
      if (insight.data_points && typeof insight.data_points === 'object' && 
          'photo_urls' in insight.data_points && 
          Array.isArray(insight.data_points.photo_urls)) {
        const photoUrls = insight.data_points.photo_urls as string[];
        const { data: dpPhotos } = await supabase
          .from("photos")
          .select("*")
          .in("photo_url", photoUrls);

        if (dpPhotos && dpPhotos.length > 0) {
          setPhotos((prev) => [...prev, ...dpPhotos]);
        }
      }
    } catch (error: any) {
      console.error("Erro ao buscar detalhes:", error);
      toast.error("Erro ao carregar detalhes do insight");
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

  const handleReview = async () => {
    if (!insightId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ai_insights")
        .update({
          status: "reviewed",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq("id", insightId);

      if (error) throw error;

      toast.success("Insight revisado com sucesso!");
      if (onUpdate) onUpdate();
      fetchInsightDetails();
    } catch (error: any) {
      toast.error("Erro ao revisar insight");
    }
  };

  const handleDismiss = async () => {
    if (!insightId) return;

    try {
      const { error } = await supabase
        .from("ai_insights")
        .update({ status: "dismissed" })
        .eq("id", insightId);

      if (error) throw error;

      toast.success("Insight arquivado");
      if (onUpdate) onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao arquivar insight");
    }
  };

  if (!insightData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getInsightIcon(insightData.insight_type)}
            {insightData.title}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            Carregando informações...
          </div>
        ) : (
          <Tabs defaultValue="insight" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="insight">Insight</TabsTrigger>
              <TabsTrigger value="entity">Entidade</TabsTrigger>
              <TabsTrigger value="data">Dados</TabsTrigger>
              <TabsTrigger value="actions">Ações</TabsTrigger>
            </TabsList>

            {/* Aba: Informações do Insight */}
            <TabsContent value="insight" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detalhes do Insight</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{getTypeLabel(insightData.insight_type)}</Badge>
                    {insightData.category && (
                      <Badge variant="secondary">{insightData.category}</Badge>
                    )}
                    {insightData.priority && (
                      <Badge variant={getPriorityColor(insightData.priority)}>
                        Prioridade: {insightData.priority}
                      </Badge>
                    )}
                    {insightData.impact_level && (
                      <Badge variant="outline">Impacto: {insightData.impact_level}</Badge>
                    )}
                  </div>

                  {insightData.description && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Descrição</p>
                      <p className="text-sm">{insightData.description}</p>
                    </div>
                  )}

                  {insightData.confidence_score && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Score de Confiança
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-bold">
                          {insightData.confidence_score}%
                        </div>
                        <div className="flex-1">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${insightData.confidence_score}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground">Gerado em</p>
                        <p className="font-medium">
                          {format(
                            new Date(insightData.generated_at),
                            "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                            { locale: ptBR }
                          )}
                        </p>
                      </div>
                    </div>

                    {insightData.reviewed_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-muted-foreground">Revisado em</p>
                          <p className="font-medium">
                            {format(new Date(insightData.reviewed_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3 border-t">
                    {insightData.status !== "reviewed" && (
                      <Button onClick={handleReview}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Marcar como Revisado
                      </Button>
                    )}
                    <Button variant="outline" onClick={handleDismiss}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Arquivar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Fotos Relacionadas */}
              {photos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Fotos Relacionadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2">
                      {photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative aspect-square rounded-lg overflow-hidden group"
                        >
                          <img
                            src={photo.photo_url}
                            alt="Foto relacionada"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              {photo.photo_type}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Aba: Entidade Relacionada */}
            <TabsContent value="entity" className="space-y-4">
              {visitData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Visita #{visitData.visit_code}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Data</p>
                        <p className="font-medium">
                          {format(new Date(visitData.scheduled_date), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge>{visitData.status}</Badge>
                      </div>
                    </div>

                    {visitData.user && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground">Promotor(a)</p>
                          <p className="text-sm">{visitData.user.nome}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Fotos</p>
                        <p className="text-lg font-bold">{visitData.photos_count || 0}</p>
                      </div>
                      {visitData.compliance_score && (
                        <div>
                          <p className="text-xs text-muted-foreground">Conformidade</p>
                          <p className="text-lg font-bold">{visitData.compliance_score}%</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Problemas</p>
                        <p className="text-lg font-bold text-destructive">
                          {visitData.issues_found || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {storeData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      {storeData.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Código</p>
                        <p className="font-mono font-medium">{storeData.code}</p>
                      </div>
                      {storeData.chain && (
                        <div>
                          <p className="text-sm text-muted-foreground">Rede</p>
                          <p className="font-medium">{storeData.chain}</p>
                        </div>
                      )}
                    </div>

                    {storeData.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Endereço</p>
                          <p className="text-sm">{storeData.address}</p>
                          <p className="text-sm">
                            {storeData.city} - {storeData.state}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {!visitData && !storeData && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhuma entidade relacionada
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Aba: Dados e Métricas */}
            <TabsContent value="data" className="space-y-4">
              {insightData.data_points && typeof insightData.data_points === 'object' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Dados do Insight
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {'our_facings' in insightData.data_points && 
                       insightData.data_points.our_facings !== undefined && (
                        <div className="flex justify-between items-center p-3 rounded bg-muted/50">
                          <span className="text-sm">Nossas Faces</span>
                          <span className="font-bold text-lg">
                            {String(insightData.data_points.our_facings)}
                          </span>
                        </div>
                      )}

                      {'competitor_facings' in insightData.data_points &&
                       insightData.data_points.competitor_facings !== undefined && (
                        <div className="flex justify-between items-center p-3 rounded bg-muted/50">
                          <span className="text-sm">Faces Concorrentes</span>
                          <span className="font-bold text-lg">
                            {String(insightData.data_points.competitor_facings)}
                          </span>
                        </div>
                      )}

                      {'our_share' in insightData.data_points &&
                       insightData.data_points.our_share !== undefined && (
                        <div className="p-3 rounded bg-muted/50">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm">Nosso Share</span>
                            <span className="font-bold text-xl text-primary">
                              {Number(insightData.data_points.our_share).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-background rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{
                                width: `${Number(insightData.data_points.our_share)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {'ai_analysis' in insightData.data_points &&
                       insightData.data_points.ai_analysis && (
                        <div className="p-3 rounded bg-muted/50">
                          <p className="text-sm text-muted-foreground mb-2">
                            Análise da IA
                          </p>
                          <pre className="text-xs overflow-auto max-h-40">
                            {JSON.stringify(
                              insightData.data_points.ai_analysis,
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {insightData.estimated_revenue_impact && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Impacto Estimado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">
                      R${" "}
                      {parseFloat(insightData.estimated_revenue_impact).toLocaleString(
                        "pt-BR",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Impacto potencial na receita
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Aba: Ações Recomendadas */}
            <TabsContent value="actions" className="space-y-4">
              {insightData.action_items && insightData.action_items.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ações Recomendadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {insightData.action_items.map((action: string, idx: number) => (
                        <li
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma ação específica recomendada</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status do Insight</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={insightData.status === "new" ? "default" : "outline"}
                    >
                      {insightData.status === "new"
                        ? "Novo"
                        : insightData.status === "reviewed"
                        ? "Revisado"
                        : insightData.status}
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    {insightData.status === "new" && (
                      <Button onClick={handleReview} className="flex-1">
                        Marcar como Revisado
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleDismiss}
                      className="flex-1"
                    >
                      Arquivar Insight
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
