import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";

interface IdealPhoto {
  id: string;
  category: string;
  photo_url: string;
  description: string | null;
  created_at: string;
}

const TradeIdealPhotos = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [photos, setPhotos] = useState<IdealPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!permissionsLoading && hasPermission("trade_stores")) {
      fetchIdealPhotos();
    }
  }, [permissionsLoading]);

  if (permissionsLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Carregando permissões...</div>
      </DashboardLayout>
    );
  }

  if (!hasPermission("trade_stores")) {
    return <Navigate to="/dashboard" replace />;
  }

  const fetchIdealPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from("ideal_pdv_photos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error("Erro ao buscar fotos ideais:", error);
      toast.error("Erro ao carregar fotos ideais");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Você precisa estar logado para fazer upload");
        return;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `ideal-pdv/${category}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("trade-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Armazenar apenas o caminho (path) por segurança
      const { error: insertError } = await supabase
        .from("ideal_pdv_photos")
        .insert({
          category,
          photo_url: filePath,
          description: `Foto ideal de ${category}`,
          created_by: userData.user.id,
        });

      if (insertError) throw insertError;

      toast.success("Foto ideal cadastrada com sucesso!");
      fetchIdealPhotos();
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("ideal_pdv_photos")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Foto removida!");
      fetchIdealPhotos();
    } catch (error: any) {
      toast.error("Erro ao remover: " + error.message);
    }
  };

  const categories = [
    { id: "gondola", name: "Gôndola Ideal" },
    { id: "fachada", name: "Fachada Ideal" },
    { id: "promocao", name: "Promoção Ideal" },
    { id: "exposicao", name: "Exposição Ideal" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Fotos Ideais do PDV</h1>
          <p className="text-muted-foreground">
            Cadastre fotos de referência para a IA usar como parâmetro nas análises
          </p>
        </div>

        {categories.map((category) => (
          <Card key={category.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">{category.name}</h3>
                <Button
                  size="sm"
                  onClick={() => document.getElementById(`upload-${category.id}`)?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Adicionar Foto
                </Button>
                <input
                  id={`upload-${category.id}`}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, category.id)}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {photos
                  .filter((p) => p.category === category.id)
                  .map((photo) => (
                    <div key={photo.id} className="relative group">
                      <img
                        src={photo.photo_url}
                        alt={photo.description || "Foto ideal"}
                        className="rounded-lg w-full h-48 object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(photo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                {photos.filter((p) => p.category === category.id).length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-2" />
                    <p>Nenhuma foto cadastrada para esta categoria</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default TradeIdealPhotos;
