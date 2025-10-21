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
