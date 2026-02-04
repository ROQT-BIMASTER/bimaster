import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Image as ImageIcon, Upload, Trash2, ExternalLink, RefreshCw, Camera } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TradeFilters } from "@/components/trade/TradeFilters";
import { PhotoDetailDialog } from "@/components/trade/PhotoDetailDialog";
import { TradePageHeader } from "@/components/trade/TradePageHeader";
import { useImpersonation } from "@/contexts/ImpersonationContext";

interface Photo {
  id: string;
  photo_url: string;
  photo_type: string;
  ai_processed: boolean;
  upload_date: string;
  ai_analysis: any;
  store_id: string | null;
  stores: {
    name: string;
  } | null;
}

const TradePhotos = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const { isImpersonating, impersonatedUser, impersonatedPermissions } = useImpersonation();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [rawPhotos, setRawPhotos] = useState<Photo[]>([]); // Fotos brutas antes do filtro de impersonação
  const [loading, setLoading] = useState(true);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [photoDetailOpen, setPhotoDetailOpen] = useState(false);
  const [subordinateIds, setSubordinateIds] = useState<string[]>([]);

  // Buscar subordinados do usuário impersonado para filtro correto
  useEffect(() => {
    const fetchSubordinates = async () => {
      if (!isImpersonating || !impersonatedUser) {
        setSubordinateIds([]);
        return;
      }

      // Verificar se é admin no contexto de impersonação
      if (impersonatedPermissions?.isAdmin) {
        setSubordinateIds([]); // Admin vê tudo
        return;
      }

      try {
        // Buscar subordinados usando a função is_supervisor_of
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .neq("id", impersonatedUser.id);

        if (error) throw error;

        // Filtrar apenas os que são subordinados do usuário impersonado
        const subordinates: string[] = [];
        for (const profile of data || []) {
          const { data: isSupervisor } = await supabase
            .rpc("is_supervisor_of", { 
              _supervisor_id: impersonatedUser.id, 
              _user_id: profile.id 
            });
          
          if (isSupervisor) {
            subordinates.push(profile.id);
          }
        }

        setSubordinateIds(subordinates);
      } catch (error) {
        console.error("Erro ao buscar subordinados:", error);
        setSubordinateIds([]);
      }
    };

    fetchSubordinates();
  }, [isImpersonating, impersonatedUser, impersonatedPermissions?.isAdmin]);

  useEffect(() => {
    if (!permissionsLoading && hasPermission("trade_photos")) {
      fetchPhotos();
    }
  }, [permissionsLoading]);

  useEffect(() => {
    fetchPhotos();

    const channel = supabase
      .channel('photos-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos' },
        () => fetchPhotos()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from("photos")
        .select(`*, stores:store_id (name)`)
        .order("upload_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      setRawPhotos(data || []);
    } catch (error) {
      console.error("Erro ao buscar fotos:", error);
      toast.error("Erro ao carregar fotos");
    } finally {
      setLoading(false);
    }
  };

  // Filtrar fotos baseado no contexto de impersonação
  const filteredByImpersonation = useMemo(() => {
    if (!isImpersonating || !impersonatedUser) {
      return rawPhotos; // Sem impersonação, retorna tudo que RLS permite
    }

    // Admin impersonado vê tudo
    if (impersonatedPermissions?.isAdmin) {
      return rawPhotos;
    }

    // Filtrar apenas fotos que o usuário impersonado deveria ver:
    // 1. Fotos próprias (vendedor_id = impersonatedUser.id)
    // 2. Fotos onde é supervisor direto (supervisor_id = impersonatedUser.id)
    // 3. Fotos de subordinados na hierarquia
    return rawPhotos.filter(photo => {
      const vendedorId = (photo as any).vendedor_id;
      const supervisorId = (photo as any).supervisor_id;
      
      // É o próprio vendedor
      if (vendedorId === impersonatedUser.id) return true;
      
      // É o supervisor direto registrado na foto
      if (supervisorId === impersonatedUser.id) return true;
      
      // É supervisor do vendedor na hierarquia
      if (subordinateIds.includes(vendedorId)) return true;
      
      return false;
    });
  }, [rawPhotos, isImpersonating, impersonatedUser, impersonatedPermissions?.isAdmin, subordinateIds]);

  // Atualizar allPhotos quando filteredByImpersonation mudar
  useEffect(() => {
    setAllPhotos(filteredByImpersonation);
    setPhotos(filteredByImpersonation);
  }, [filteredByImpersonation]);

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

  const handleDeletePhoto = async () => {
    if (!deletingPhotoId) return;

    try {
      const { error } = await supabase
        .from("photos")
        .delete()
        .eq("id", deletingPhotoId);

      if (error) throw error;

      toast.success("Foto excluída com sucesso!");
      fetchPhotos();
      setDeletingPhotoId(null);
    } catch (error: any) {
      toast.error("Erro ao excluir foto: " + error.message);
    }
  };

  const applyFilters = () => {
    let filtered = [...allPhotos];

    if (selectedStore) {
      filtered = filtered.filter(p => p.store_id === selectedStore);
    }

    if (aiCriteria) {
      if (aiCriteria.aiProcessed !== undefined) {
        filtered = filtered.filter(p => p.ai_processed === aiCriteria.aiProcessed);
      }
      if (aiCriteria.type) {
        filtered = filtered.filter(p => p.photo_type === aiCriteria.type);
      }
      if (aiCriteria.timeframe === "hoje") {
        const today = new Date().toISOString().split('T')[0];
        filtered = filtered.filter(p => p.upload_date.startsWith(today));
      }
      if (aiCriteria.timeframe === "semana") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = filtered.filter(p => new Date(p.upload_date) >= weekAgo);
      }
    }

    setPhotos(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [selectedStore, aiCriteria, allPhotos]);

  if (permissionsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-trade" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hasPermission("trade_photos")) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
        <TradePageHeader
          title="Análise de Fotos"
          description={`${photos.length} fotos capturadas`}
          actions={
            <>
              <Button 
                variant="outline"
                size="sm"
                className="h-9 text-xs sm:text-sm"
                onClick={() => {
                  setLoading(true);
                  fetchPhotos();
                }}
              >
                <RefreshCw className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
              <Button 
                size="sm"
                className="h-9 text-xs sm:text-sm bg-trade hover:bg-trade-dark"
                onClick={() => toast.info("Use o Lançamento Rápido no módulo Trade Marketing.")}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                <span>Upload</span>
              </Button>
            </>
          }
        />

        <TradeFilters
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
        />

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
              <div className="p-3 bg-trade-light rounded-full mb-3">
                <Camera className="h-8 w-8 text-trade" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-1">Nenhuma foto encontrada</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Faça upload de fotos para começar
              </p>
              <Button 
                size="sm"
                className="bg-trade hover:bg-trade-dark"
                onClick={() => toast.info("Use o Lançamento Rápido no módulo Trade Marketing.")}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload de Fotos
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {photos.map((photo) => (
              <Card 
                key={photo.id} 
                className="overflow-hidden group hover:shadow-lg active:scale-[0.98] transition-all cursor-pointer touch-manipulation border-0 sm:border"
                onClick={() => {
                  setSelectedPhotoId(photo.id);
                  setPhotoDetailOpen(true);
                }}
              >
                <div className="aspect-square bg-muted relative">
                  {photo.photo_url ? (
                    <img 
                      src={photo.photo_url} 
                      alt={getTypeLabel(photo.photo_type)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Overlay badges - Mobile */}
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 sm:p-2 bg-gradient-to-t from-black/70 to-transparent">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] h-5 bg-white/90 text-foreground">
                        {getTypeLabel(photo.photo_type)}
                      </Badge>
                      {photo.ai_processed && (
                        <Badge className="text-[10px] h-5 bg-trade text-white">IA</Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Desktop hover actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex gap-2">
                    {photo.photo_url && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(photo.photo_url, '_blank');
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingPhotoId(photo.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Details - Hidden on mobile, shown on desktop */}
                <CardContent className="p-2 sm:p-3 hidden sm:block">
                  <p className="font-medium text-xs sm:text-sm truncate">
                    {photo.stores?.name || "Loja não especificada"}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {new Date(photo.upload_date).toLocaleDateString("pt-BR")}
                  </p>
                  
                  {photo.ai_processed && photo.ai_analysis?.compliance_score && (
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-[10px] text-muted-foreground">Conformidade:</span>
                      <Badge 
                        variant={photo.ai_analysis.compliance_score >= 80 ? "default" : "destructive"}
                        className="text-[10px] h-4"
                      >
                        {photo.ai_analysis.compliance_score}%
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <PhotoDetailDialog
          photoId={selectedPhotoId}
          open={photoDetailOpen}
          onOpenChange={setPhotoDetailOpen}
        />

        <AlertDialog open={!!deletingPhotoId} onOpenChange={(open) => !open && setDeletingPhotoId(null)}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta foto?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePhoto} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default TradePhotos;
