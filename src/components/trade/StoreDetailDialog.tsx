import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Camera, DollarSign, FileText, MapPin, Phone, Store, TrendingUp, User, Lightbulb, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StoreShareHistoryChart } from "./StoreShareHistoryChart";
import { Separator } from "@/components/ui/separator";

interface StoreDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string | null;
}

export const StoreDetailDialog = ({ open, onOpenChange, storeId }: StoreDetailDialogProps) => {
  const [store, setStore] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [scheduledVisits, setScheduledVisits] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && storeId) {
      fetchStoreDetails();
    }
  }, [open, storeId]);

  const fetchStoreDetails = async () => {
    if (!storeId) return;
    
    setLoading(true);
    try {
      // Buscar dados da loja
      const { data: storeData } = await supabase
        .from("stores")
        .select("*")
        .eq("id", storeId)
        .single();

      setStore(storeData);

      // Buscar visitas realizadas
      const { data: visitsData } = await supabase
        .from("visits")
        .select(`
          *,
          user:profiles!visits_user_id_fkey(nome)
        `)
        .eq("store_id", storeId)
        .in("status", ["completed", "in_progress"])
        .order("visit_date", { ascending: false })
        .limit(20);

      setVisits(visitsData || []);

      // Buscar visitas agendadas
      const { data: scheduledVisitsData } = await supabase
        .from("visits")
        .select(`
          *,
          user:profiles!visits_user_id_fkey(nome)
        `)
        .eq("store_id", storeId)
        .eq("status", "scheduled")
        .order("scheduled_date", { ascending: true })
        .limit(20);

      setScheduledVisits(scheduledVisitsData || []);

      // Buscar insights de IA
      const { data: insightsData } = await supabase
        .from("ai_insights")
        .select("*")
        .eq("entity_type", "store")
        .eq("entity_id", storeId)
        .order("generated_at", { ascending: false })
        .limit(20);

      setInsights(insightsData || []);

      // Buscar fotos
      const { data: photosData } = await supabase
        .from("photos")
        .select("*")
        .eq("store_id", storeId)
        .order("upload_date", { ascending: false })
        .limit(50);

      setPhotos(photosData || []);

      // Buscar auditorias de gôndola
      const { data: auditsData } = await supabase
        .from("gondola_audits")
        .select(`
          *,
          product:products(nome),
          visit:visits(visit_date, visit_code)
        `)
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);

      setAudits(auditsData || []);

      // Buscar investimentos
      const { data: investmentsData } = await supabase
        .from("trade_investments")
        .select("*")
        .eq("store_id", storeId)
        .order("investment_date", { ascending: false })
        .limit(20);

      setInvestments(investmentsData || []);

      // Buscar promoções ativas
      const { data: promotionsData } = await supabase
        .from("promotion_execution")
        .select(`
          *,
          promotion:promotions(name, code, promotion_type)
        `)
        .eq("store_id", storeId)
        .order("checked_at", { ascending: false })
        .limit(20);

      setPromotions(promotionsData || []);

    } catch (error) {
      console.error("Erro ao carregar detalhes da loja:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!store) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {store.name}
          </DialogTitle>
          <div className="flex gap-2 items-center text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {store.address}, {store.city} - {store.state}
          </div>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
            <TabsTrigger value="visits">Visitas</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="photos">Fotos</TabsTrigger>
            <TabsTrigger value="audits">Auditorias</TabsTrigger>
            <TabsTrigger value="investments">Investimentos</TabsTrigger>
            <TabsTrigger value="promotions">Promoções</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4">
            <TabsContent value="info" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações do PDV</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Código</p>
                    <p className="text-base">{store.code}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rede</p>
                    <p className="text-base">{store.chain || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">CNPJ</p>
                    <p className="text-base">{store.cnpj || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                    <p className="text-base">{store.phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Gerente</p>
                    <p className="text-base">{store.manager_name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tel. Gerente</p>
                    <p className="text-base">{store.manager_phone || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge variant={store.status === "active" ? "default" : "secondary"}>
                      {store.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Prioridade</p>
                    <Badge variant="outline">{store.priority || "Normal"}</Badge>
                  </div>
                </CardContent>
              </Card>

              {store.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{store.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="share">
              <StoreShareHistoryChart storeId={storeId} months={6} />
            </TabsContent>

            <TabsContent value="visits" className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Visitas Realizadas ({visits.length})
                </h3>
                {loading ? (
                  <p className="text-center text-muted-foreground">Carregando...</p>
                ) : visits.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhuma visita realizada</p>
                ) : (
                  <div className="space-y-3">
                    {visits.map((visit) => (
                      <Card key={visit.id}>
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">{visit.visit_code}</CardTitle>
                              <CardDescription className="flex items-center gap-2 mt-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(visit.visit_date || visit.scheduled_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                {visit.check_in_time && (
                                  <span className="text-xs">• Check-in: {format(new Date(visit.check_in_time), "HH:mm")}</span>
                                )}
                              </CardDescription>
                            </div>
                            <Badge variant={
                              visit.status === "completed" ? "default" : 
                              visit.status === "in_progress" ? "secondary" : "outline"
                            }>
                              {visit.status === "completed" ? "Concluída" : 
                               visit.status === "in_progress" ? "Em andamento" : visit.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <User className="h-3 w-3" />
                            {visit.user?.nome || "Não informado"}
                          </div>
                          {visit.visit_type && (
                            <div className="flex items-center gap-2 text-sm mb-2">
                              <Badge variant="outline" className="text-xs">
                                {visit.visit_type}
                              </Badge>
                            </div>
                          )}
                          {visit.notes && (
                            <p className="text-sm mt-2 text-muted-foreground">{visit.notes}</p>
                          )}
                          {visit.compliance_score !== null && (
                            <div className="mt-2 pt-2 border-t">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Conformidade</span>
                                <Badge variant={visit.compliance_score >= 80 ? "default" : "destructive"}>
                                  {visit.compliance_score}%
                                </Badge>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Visitas Agendadas ({scheduledVisits.length})
                </h3>
                {loading ? (
                  <p className="text-center text-muted-foreground">Carregando...</p>
                ) : scheduledVisits.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nenhuma visita agendada</p>
                ) : (
                  <div className="space-y-3">
                    {scheduledVisits.map((visit) => (
                      <Card key={visit.id} className="border-l-4 border-l-primary">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">{visit.visit_code}</CardTitle>
                              <CardDescription className="flex items-center gap-2 mt-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(visit.scheduled_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                {visit.scheduled_time && (
                                  <span className="text-xs">• {visit.scheduled_time}</span>
                                )}
                              </CardDescription>
                            </div>
                            <Badge variant="secondary">
                              Agendada
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <User className="h-3 w-3" />
                            {visit.user?.nome || "Não informado"}
                          </div>
                          {visit.visit_type && (
                            <div className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="text-xs">
                                {visit.visit_type}
                              </Badge>
                            </div>
                          )}
                          {visit.notes && (
                            <p className="text-sm mt-2 text-muted-foreground">{visit.notes}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="insights" className="space-y-3">
              <div className="mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  Insights de IA ao Longo do Tempo
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Histórico de análises e recomendações geradas pela IA
                </p>
              </div>
              
              {loading ? (
                <p className="text-center text-muted-foreground">Carregando...</p>
              ) : insights.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhum insight registrado para este PDV
                  </CardContent>
                </Card>
              ) : (
                insights.map((insight) => (
                  <Card key={insight.id} className={`border-l-4 ${
                    insight.impact_level === "high" ? "border-l-destructive" :
                    insight.impact_level === "medium" ? "border-l-orange-500" :
                    "border-l-blue-500"
                  }`}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Lightbulb className="h-4 w-4" />
                            {insight.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {format(new Date(insight.generated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Badge variant={
                            insight.priority === "alta" ? "destructive" :
                            insight.priority === "media" ? "default" : "secondary"
                          }>
                            {insight.priority || "Normal"}
                          </Badge>
                          <Badge variant="outline">
                            {insight.insight_type}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-3">{insight.description}</p>
                      
                      {insight.confidence_score && (
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <span className="text-muted-foreground">Confiança:</span>
                          <Badge variant="outline">{insight.confidence_score}%</Badge>
                        </div>
                      )}

                      {insight.estimated_revenue_impact && (
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <DollarSign className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Impacto estimado:</span>
                          <span className="font-medium">R$ {insight.estimated_revenue_impact.toFixed(2)}</span>
                        </div>
                      )}

                      {insight.action_items && insight.action_items.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm font-medium mb-2">Ações Recomendadas:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {insight.action_items.map((action: string, idx: number) => (
                              <li key={idx} className="text-sm text-muted-foreground">{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {insight.status && (
                        <div className="mt-3 pt-3 border-t">
                          <Badge variant={
                            insight.status === "actioned" ? "default" :
                            insight.status === "reviewed" ? "secondary" : "outline"
                          }>
                            {insight.status === "actioned" ? "Ação tomada" :
                             insight.status === "reviewed" ? "Revisado" :
                             insight.status === "dismissed" ? "Descartado" : "Novo"}
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="photos" className="space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground">Carregando...</p>
              ) : photos.length === 0 ? (
                <p className="text-center text-muted-foreground">Nenhuma foto registrada</p>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {photos.map((photo) => (
                    <Card key={photo.id} className="overflow-hidden">
                      <img 
                        src={photo.photo_url} 
                        alt={photo.photo_type}
                        className="w-full h-40 object-cover"
                      />
                      <CardContent className="p-3">
                        <p className="text-sm font-medium">{photo.photo_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(photo.upload_date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        {photo.compliance_score && (
                          <Badge variant="outline" className="mt-2">
                            Score: {photo.compliance_score}%
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="audits" className="space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground">Carregando...</p>
              ) : audits.length === 0 ? (
                <p className="text-center text-muted-foreground">Nenhuma auditoria registrada</p>
              ) : (
                audits.map((audit) => (
                  <Card key={audit.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{audit.product?.nome || "Produto"}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(audit.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        <Badge variant={audit.produto_presente ? "default" : "destructive"}>
                          {audit.produto_presente ? "Presente" : "Ausente"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Frentes</p>
                          <p className="font-medium">{audit.quantidade_frentes}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Preço</p>
                          <p className="font-medium">R$ {audit.preco_praticado?.toFixed(2) || "-"}</p>
                        </div>
                      </div>
                      {audit.observacoes && (
                        <p className="text-sm mt-2 text-muted-foreground">{audit.observacoes}</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="investments" className="space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground">Carregando...</p>
              ) : investments.length === 0 ? (
                <p className="text-center text-muted-foreground">Nenhum investimento registrado</p>
              ) : (
                investments.map((investment) => (
                  <Card key={investment.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            R$ {investment.amount.toFixed(2)}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {investment.category} • {format(new Date(investment.investment_date), "dd/MM/yyyy", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        <Badge variant={
                          investment.status === "approved" ? "default" :
                          investment.status === "pending" ? "secondary" : "destructive"
                        }>
                          {investment.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    {investment.description && (
                      <CardContent>
                        <p className="text-sm">{investment.description}</p>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="promotions" className="space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground">Carregando...</p>
              ) : promotions.length === 0 ? (
                <p className="text-center text-muted-foreground">Nenhuma promoção registrada</p>
              ) : (
                promotions.map((promo) => (
                  <Card key={promo.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            {promo.promotion?.name || "Promoção"}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {promo.promotion?.code} • {format(new Date(promo.checked_at), "dd/MM/yyyy", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        <Badge variant={promo.is_compliant ? "default" : "destructive"}>
                          {promo.is_compliant ? "Conforme" : "Não conforme"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {promo.compliance_score && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Score de Conformidade</span>
                            <span className="font-medium">{promo.compliance_score}%</span>
                          </div>
                        )}
                        {promo.observations && (
                          <p className="text-muted-foreground mt-2">{promo.observations}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
