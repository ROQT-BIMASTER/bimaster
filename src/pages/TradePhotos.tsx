import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Image as ImageIcon, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";

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
  const [loading, setLoading] = useState(true);

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
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload de Fotos
          </Button>
        </div>

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
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload de Fotos
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <Card key={photo.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-muted relative">
                  {/* Placeholder for photo - in real app would load from storage */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
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
      </div>
    </DashboardLayout>
  );
};

export default TradePhotos;
