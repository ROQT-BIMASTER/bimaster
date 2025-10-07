import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Image as ImageIcon, Upload, Trash2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TradeFilters } from "@/components/trade/TradeFilters";

interface Photo {
  id: string;
  photo_url: string;
  photo_type: string;
  ai_processed: boolean;
  upload_date: string;
  stores: {
    name: string;
  } | null;
}

const TradePhotos = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);

  if (!permissionsLoading && !hasPermission("trade_photos")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from("photos")
        .select(`
          *,
          stores:store_id (name)
        `)
        .order("upload_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      setAllPhotos(data || []);
      setPhotos(data || []);
    } catch (error) {
      console.error("Erro ao buscar fotos:", error);
      toast.error("Erro ao carregar fotos");
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
      console.error("Erro ao excluir foto:", error);
      toast.error("Erro ao excluir foto: " + error.message);
    }
  };

  const applyFilters = () => {
    let filtered = [...allPhotos];

    if (selectedStore) {
      filtered = filtered.filter(p => p.stores && (p.stores as any).id === selectedStore);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Análise de Fotos</h1>
            <p className="text-muted-foreground">
              Gestão e análise de fotos de campo
            </p>
          </div>
          <Button onClick={() => toast.info("Funcionalidade de upload em desenvolvimento. Use o cadastro rápido em Trade Marketing.")}>
            <Upload className="mr-2 h-4 w-4" />
            Upload de Fotos
          </Button>
        </div>

        <TradeFilters
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
        />

        {loading ? (
          <div className="text-center py-12">Carregando fotos...</div>
        ) : photos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma foto encontrada</h3>
              <p className="text-muted-foreground mb-4">
                Faça upload de fotos para começar a análise
              </p>
              <Button onClick={() => toast.info("Funcionalidade de upload em desenvolvimento. Use o cadastro rápido em Trade Marketing.")}>
                <Upload className="mr-2 h-4 w-4" />
                Upload de Fotos
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <Card key={photo.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-muted relative">
                  {photo.photo_url ? (
                    <img 
                      src={photo.photo_url} 
                      alt={getTypeLabel(photo.photo_type)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    {photo.photo_url && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(photo.photo_url, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeletingPhotoId(photo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{getTypeLabel(photo.photo_type)}</Badge>
                    {photo.ai_processed && (
                      <Badge variant="secondary">IA Processada</Badge>
                    )}
                  </div>
                  <p className="font-medium text-sm truncate">
                    {photo.stores?.name || "Loja não especificada"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(photo.upload_date).toLocaleDateString("pt-BR")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={!!deletingPhotoId} onOpenChange={(open) => !open && setDeletingPhotoId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta foto? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePhoto} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
