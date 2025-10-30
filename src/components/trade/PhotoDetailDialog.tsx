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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Store,
  MapPin,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  TrendingUp,
  ImageIcon,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Briefcase,
  User,
  Ruler,
  Target,
  Award,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PhotoDetailDialogProps {
  photoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PhotoDetailDialog({ photoId, open, onOpenChange }: PhotoDetailDialogProps) {
  const [loading, setLoading] = useState(true);
  const [photoData, setPhotoData] = useState<any>(null);
  const [storeData, setStoreData] = useState<any>(null);
  const [visitData, setVisitData] = useState<any>(null);
  const [investments, setInvestments] = useState<any[]>([]);
  const [relatedPhotos, setRelatedPhotos] = useState<any[]>([]);
  const [shelfShare, setShelfShare] = useState<any[]>([]);
  const [shelfMeasurements, setShelfMeasurements] = useState<any[]>([]);

  useEffect(() => {
    if (photoId && open) {
      fetchPhotoDetails();
    }
  }, [photoId, open]);

  const fetchPhotoDetails = async () => {
    if (!photoId) return;

    try {
      setLoading(true);

      // Buscar foto
      const { data: photo, error: photoError } = await supabase
        .from("photos")
        .select("*")
        .eq("id", photoId)
        .maybeSingle();

      if (photoError) throw photoError;
      if (!photo) {
        toast.error("Foto não encontrada");
        setLoading(false);
        return;
      }
      
      setPhotoData(photo);

      if (!photo?.store_id) {
        setLoading(false);
        return;
      }

      // Buscar dados da loja
      const { data: store } = await supabase
        .from("stores")
        .select("*")
        .eq("id", photo.store_id)
        .maybeSingle();

      setStoreData(store);

      // Buscar dados da visita se houver
      if (photo.visit_id) {
        const { data: visit } = await supabase
          .from("visits")
          .select("*")
          .eq("id", photo.visit_id)
          .maybeSingle();

        // Buscar dados do usuário separadamente
        if (visit?.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nome, email")
            .eq("id", visit.user_id)
            .maybeSingle();
          
          if (profile) {
            (visit as any).user = profile;
          }
        }

        setVisitData(visit);

        // Buscar outras fotos da mesma visita
        const { data: photos } = await supabase
          .from("photos")
          .select("*")
          .eq("visit_id", photo.visit_id)
          .neq("id", photoId)
          .limit(10);

        setRelatedPhotos(photos || []);
      }

      // Buscar investimentos recentes no PDV
      const { data: investmentData } = await supabase
        .from("trade_investments")
        .select("*")
        .eq("store_id", photo.store_id)
        .order("investment_date", { ascending: false })
        .limit(5);

      setInvestments(investmentData || []);

      // Buscar shelf share relacionado à visita
      if (photo.visit_id) {
        const { data: shelfData } = await supabase
          .from("shelf_share")
          .select("*")
          .eq("visit_id", photo.visit_id)
          .limit(10);

        setShelfShare(shelfData || []);
        
        // Buscar medições de prateleira relacionadas à visita
        const { data: measurementsData } = await supabase
          .from("shelf_measurements")
          .select("*")
          .eq("visit_id", photo.visit_id)
          .order("created_at", { ascending: false });

        setShelfMeasurements(measurementsData || []);
      }

    } catch (error: any) {
      console.error("Erro ao buscar detalhes:", error);
      toast.error("Erro ao carregar detalhes da foto");
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      gondola: "Gôndola",
      fachada: "Fachada",
      preco: "Preço",
      estoque: "Estoque",
      concorrente: "Concorrente",
      promocao: "Promoção",
      ruptura: "Ruptura",
    };
    return labels[type] || type;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      gondola_material: "Material de Gôndola",
      pos_material: "Material POS",
      refrigerator: "Refrigerador",
      freezer: "Freezer",
      display: "Display",
      shelf: "Prateleira",
      signage: "Sinalização",
      promotional_material: "Material Promocional",
      equipment: "Equipamento",
      other: "Outro",
    };
    return labels[category] || category;
  };

  if (!photoData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Detalhes da Foto - {getTypeLabel(photoData.photo_type)}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            Carregando informações...
          </div>
        ) : (
          <Tabs defaultValue="photo" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="photo">Foto</TabsTrigger>
              <TabsTrigger value="store">PDV</TabsTrigger>
              <TabsTrigger value="visit">Visita</TabsTrigger>
              <TabsTrigger value="investments">Investimentos</TabsTrigger>
              <TabsTrigger value="analysis">Análise</TabsTrigger>
            </TabsList>

            {/* Aba: Informações da Foto */}
            <TabsContent value="photo" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Imagem</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {photoData.photo_url ? (
                      <img
                        src={photoData.photo_url}
                        alt="Foto"
                        className="w-full h-auto rounded-lg"
                      />
                    ) : (
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Informações</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{getTypeLabel(photoData.photo_type)}</Badge>
                      {photoData.ai_processed && (
                        <Badge variant="secondary">IA Processada</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Upload:</span>
                      <span>{format(new Date(photoData.upload_date), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>

                    {photoData.ai_analysis?.processed_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-muted-foreground">Processado:</span>
                        <span>{format(new Date(photoData.ai_analysis.processed_at), "dd/MM/yyyy HH:mm")}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Outras fotos da mesma visita */}
              {relatedPhotos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Outras Fotos da Visita</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-2">
                      {relatedPhotos.map((photo) => (
                        <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer">
                          <img
                            src={photo.photo_url}
                            alt={getTypeLabel(photo.photo_type)}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              {getTypeLabel(photo.photo_type)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Aba: Informações do PDV */}
            <TabsContent value="store" className="space-y-4">
              {storeData ? (
                <>
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
                        {storeData.category && (
                          <div>
                            <p className="text-sm text-muted-foreground">Categoria</p>
                            <Badge variant="outline">{storeData.category}</Badge>
                          </div>
                        )}
                        {storeData.size && (
                          <div>
                            <p className="text-sm text-muted-foreground">Porte</p>
                            <Badge variant="secondary">{storeData.size}</Badge>
                          </div>
                        )}
                      </div>

                      {storeData.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Endereço</p>
                            <p className="text-sm">{storeData.address}</p>
                            <p className="text-sm">{storeData.city} - {storeData.state}</p>
                          </div>
                        </div>
                      )}

                      {storeData.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Telefone</p>
                            <p className="text-sm">{storeData.phone}</p>
                          </div>
                        </div>
                      )}

                      {storeData.manager_name && (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Gerente</p>
                            <p className="text-sm">{storeData.manager_name}</p>
                            {storeData.manager_phone && (
                              <p className="text-xs text-muted-foreground">{storeData.manager_phone}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {storeData.monthly_revenue && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Faturamento Mensal</p>
                            <p className="text-sm font-medium">
                              R$ {parseFloat(storeData.monthly_revenue).toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhuma informação de PDV disponível
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Aba: Informações da Visita */}
            <TabsContent value="visit" className="space-y-4">
              {visitData ? (
                <>
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
                          <p className="text-sm text-muted-foreground">Data Agendada</p>
                          <p className="font-medium">
                            {format(new Date(visitData.scheduled_date), "dd/MM/yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <Badge>{visitData.status}</Badge>
                        </div>
                      </div>

                      {visitData.check_in_time && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Check-in</p>
                            <p className="text-sm">
                              {format(new Date(visitData.check_in_time), "HH:mm")}
                            </p>
                          </div>
                          {visitData.check_out_time && (
                            <div>
                              <p className="text-sm text-muted-foreground">Check-out</p>
                              <p className="text-sm">
                                {format(new Date(visitData.check_out_time), "HH:mm")}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {visitData.duration_minutes && (
                        <div>
                          <p className="text-sm text-muted-foreground">Duração</p>
                          <p className="text-sm font-medium">{visitData.duration_minutes} minutos</p>
                        </div>
                      )}

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

                      {visitData.notes && (
                        <div className="pt-3 border-t">
                          <p className="text-sm text-muted-foreground mb-1">Observações</p>
                          <p className="text-sm">{visitData.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Shelf Share */}
                  {shelfShare.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Shelf Share Registrado</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {shelfShare.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                              <div className="flex items-center gap-2">
                                {item.in_stock ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                                <span className="text-sm">
                                  Faces: {item.quantity_facings || 0}
                                </span>
                              </div>
                              {item.price_found && (
                                <span className="text-sm font-medium">
                                  R$ {parseFloat(item.price_found).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhuma visita associada a esta foto
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Aba: Investimentos */}
            <TabsContent value="investments" className="space-y-4">
              {investments.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Investimentos Recentes no PDV</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {investments.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                R$ {parseFloat(inv.amount).toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                              <Badge variant="outline" className="ml-2">
                                {getCategoryLabel(inv.category)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(inv.investment_date), "dd/MM/yyyy")}
                            </p>
                            {inv.description && (
                              <p className="text-sm mt-1">{inv.description}</p>
                            )}
                          </div>
                          <Badge variant={
                            inv.status === "completed" ? "default" :
                            inv.status === "approved" ? "secondary" :
                            inv.status === "rejected" ? "destructive" : "outline"
                          }>
                            {inv.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nenhum investimento registrado para este PDV
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Aba: Análise da IA */}
            <TabsContent value="analysis" className="space-y-4">
              {/* Medições de Prateleira e Score */}
              {shelfMeasurements.length > 0 && (
                <>
                  {/* Score Geral do Trabalho */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        Score de Qualidade do Trabalho
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const totalMeasurements = shelfMeasurements.length;
                        const avgShelfShare = shelfMeasurements.reduce((acc, m) => acc + (m.shelf_share_percentage || 0), 0) / totalMeasurements;
                        const avgFacingShare = shelfMeasurements.reduce((acc, m) => acc + (m.facing_share_percentage || 0), 0) / totalMeasurements;
                        const completeness = shelfMeasurements.filter(m => 
                          m.total_shelf_width_cm && m.our_brands_width_cm && m.competitors_width_cm
                        ).length / totalMeasurements * 100;
                        
                        // Cálculo do score: média ponderada
                        const qualityScore = Math.round(
                          (avgShelfShare * 0.4) + 
                          (avgFacingShare * 0.3) + 
                          (completeness * 0.3)
                        );

                        return (
                          <>
                            <div className="flex items-center gap-4 mb-6">
                              <div className={`text-5xl font-bold ${
                                qualityScore >= 80 ? "text-green-500" :
                                qualityScore >= 60 ? "text-yellow-500" :
                                "text-destructive"
                              }`}>
                                {qualityScore}
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Qualidade Geral</span>
                                  <span className="font-medium">
                                    {qualityScore >= 80 ? "Excelente" :
                                     qualityScore >= 60 ? "Bom" :
                                     qualityScore >= 40 ? "Regular" : "Precisa Melhorar"}
                                  </span>
                                </div>
                                <div className="h-3 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${
                                      qualityScore >= 80 ? "bg-green-500" :
                                      qualityScore >= 60 ? "bg-yellow-500" :
                                      "bg-destructive"
                                    }`}
                                    style={{ width: `${qualityScore}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div className="text-center p-3 rounded-lg bg-muted/50">
                                <p className="text-xs text-muted-foreground mb-1">Share Médio</p>
                                <p className="text-2xl font-bold">{avgShelfShare.toFixed(1)}%</p>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-muted/50">
                                <p className="text-xs text-muted-foreground mb-1">Facing Share</p>
                                <p className="text-2xl font-bold">{avgFacingShare.toFixed(1)}%</p>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-muted/50">
                                <p className="text-xs text-muted-foreground mb-1">Completude</p>
                                <p className="text-2xl font-bold">{completeness.toFixed(0)}%</p>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Detalhamento das Medições */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Ruler className="h-5 w-5" />
                        Medições de Prateleira
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {shelfMeasurements.map((measurement) => (
                        <div key={measurement.id} className="p-4 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold">{measurement.shelf_section || "Seção"}</h4>
                            <Badge variant="outline">
                              {format(new Date(measurement.measurement_date), "dd/MM/yyyy")}
                            </Badge>
                          </div>

                          {/* Dimensões Totais */}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="text-center p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">Largura Total</p>
                              <p className="font-bold">{measurement.total_shelf_width_cm} cm</p>
                            </div>
                            <div className="text-center p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">Altura</p>
                              <p className="font-bold">{measurement.total_shelf_height_cm} cm</p>
                            </div>
                            <div className="text-center p-2 rounded bg-muted/50">
                              <p className="text-xs text-muted-foreground">Total Facings</p>
                              <p className="font-bold">{measurement.total_facings}</p>
                            </div>
                          </div>

                          {/* Comparação Nossas Marcas vs Concorrentes */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <Target className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">Nossas Marcas</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                                <p className="text-xs text-muted-foreground mb-1">Largura</p>
                                <p className="text-lg font-bold text-primary">
                                  {measurement.our_brands_width_cm} cm
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {measurement.our_brands_facings} facings
                                </p>
                              </div>
                              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                                <p className="text-xs text-muted-foreground mb-1">Concorrentes</p>
                                <p className="text-lg font-bold text-destructive">
                                  {measurement.competitors_width_cm} cm
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {measurement.competitors_facings} facings
                                </p>
                              </div>
                            </div>

                            {/* Gráfico de Share */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">Share da Gôndola</span>
                                <span className="font-bold text-primary">
                                  {measurement.shelf_share_percentage?.toFixed(1)}%
                                </span>
                              </div>
                              <div className="h-6 bg-muted rounded-full overflow-hidden flex">
                                <div
                                  className="bg-primary flex items-center justify-center text-xs text-white font-medium"
                                  style={{ width: `${measurement.shelf_share_percentage}%` }}
                                >
                                  {measurement.shelf_share_percentage > 15 && "Nosso"}
                                </div>
                                <div
                                  className="bg-destructive flex items-center justify-center text-xs text-white font-medium"
                                  style={{ width: `${100 - measurement.shelf_share_percentage}%` }}
                                >
                                  {(100 - measurement.shelf_share_percentage) > 15 && "Concorrentes"}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">Share de Facings</span>
                                <span className="font-bold text-primary">
                                  {measurement.facing_share_percentage?.toFixed(1)}%
                                </span>
                              </div>
                              <div className="h-6 bg-muted rounded-full overflow-hidden flex">
                                <div
                                  className="bg-primary flex items-center justify-center text-xs text-white font-medium"
                                  style={{ width: `${measurement.facing_share_percentage}%` }}
                                >
                                  {measurement.facing_share_percentage > 15 && "Nosso"}
                                </div>
                                <div
                                  className="bg-destructive flex items-center justify-center text-xs text-white font-medium"
                                  style={{ width: `${100 - measurement.facing_share_percentage}%` }}
                                >
                                  {(100 - measurement.facing_share_percentage) > 15 && "Concorrentes"}
                                </div>
                              </div>
                            </div>
                          </div>

                          {measurement.observations && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-muted-foreground mb-1">Observações</p>
                              <p className="text-sm">{measurement.observations}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}

              {photoData.ai_processed && photoData.ai_analysis ? (
                <>
                  {photoData.ai_analysis.compliance_score && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Score de Conformidade</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <div className={`text-4xl font-bold ${
                            photoData.ai_analysis.compliance_score >= 80 ? "text-green-500" :
                            photoData.ai_analysis.compliance_score >= 60 ? "text-yellow-500" :
                            "text-destructive"
                          }`}>
                            {photoData.ai_analysis.compliance_score}%
                          </div>
                          <div className="flex-1">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  photoData.ai_analysis.compliance_score >= 80 ? "bg-green-500" :
                                  photoData.ai_analysis.compliance_score >= 60 ? "bg-yellow-500" :
                                  "bg-destructive"
                                }`}
                                style={{ width: `${photoData.ai_analysis.compliance_score}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {photoData.ai_analysis.insights && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Insights da IA
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{photoData.ai_analysis.insights}</p>
                      </CardContent>
                    </Card>
                  )}

                  {photoData.ai_analysis.issues && photoData.ai_analysis.issues.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2 text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          Problemas Identificados
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {photoData.ai_analysis.issues.map((issue: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {photoData.ai_analysis.recommendations && photoData.ai_analysis.recommendations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Recomendações
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {photoData.ai_analysis.recommendations.map((rec: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Esta foto ainda não foi processada pela IA</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
