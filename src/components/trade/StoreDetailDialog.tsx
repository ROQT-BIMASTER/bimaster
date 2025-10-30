import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Camera, DollarSign, FileText, MapPin, Phone, Store, TrendingUp, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { StoreShareHistoryChart } from "./StoreShareHistoryChart";

interface StoreDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string | null;
}

export const StoreDetailDialog = ({ open, onOpenChange, storeId }: StoreDetailDialogProps) => {
  const [store, setStore] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
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

      // Buscar visitas
      const { data: visitsData } = await supabase
        .from("visits")
        .select(`
          *,
          user:profiles!visits_user_id_fkey(nome)
        `)
        .eq("store_id", storeId)
        .order("visit_date", { ascending: false })
        .limit(20);

      setVisits(visitsData || []);

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
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
            <TabsTrigger value="visits">Visitas</TabsTrigger>
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

            <TabsContent value="visits" className="space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground">Carregando...</p>
              ) : visits.length === 0 ? (
                <p className="text-center text-muted-foreground">Nenhuma visita registrada</p>
              ) : (
                visits.map((visit) => (
                  <Card key={visit.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base">{visit.visit_code}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(visit.visit_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        <Badge variant={visit.status === "completed" ? "default" : "secondary"}>
                          {visit.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        {visit.user?.nome}
                      </div>
                      {visit.observations && (
                        <p className="text-sm mt-2">{visit.observations}</p>
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
