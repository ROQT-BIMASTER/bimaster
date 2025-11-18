import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Trash2, Image as ImageIcon, ArrowLeft, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

interface GuidePhoto {
  id: string;
  photo_url: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
}

const TradeMeasurementGuide = () => {
  const navigate = useNavigate();
  const { isAdminOrSupervisor } = useUserRole();
  const [photos, setPhotos] = useState<GuidePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    order_index: ""
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchGuidePhotos();
  }, []);

  const fetchGuidePhotos = async () => {
    try {
      const { data, error } = await supabase
        .from("measurement_guide_photos" as any)
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;
      setPhotos((data as any) || []);
    } catch (error) {
      console.error("Erro ao buscar fotos do guia:", error);
      toast.error("Erro ao carregar guia de medição");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !formData.title) {
      toast.error("Preencha o título e selecione uma foto");
      return;
    }

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Você precisa estar logado");
        return;
      }

      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `measurement-guide/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("trade-photos")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Armazenar apenas o caminho (path) por segurança
      const { error: insertError } = await supabase
        .from("measurement_guide_photos" as any)
        .insert({
          photo_url: filePath,
          title: formData.title,
          description: formData.description || null,
          order_index: parseInt(formData.order_index) || photos.length + 1,
          created_by: userData.user.id,
        });

      if (insertError) throw insertError;

      toast.success("Foto adicionada ao guia!");
      setDialogOpen(false);
      resetForm();
      fetchGuidePhotos();
    } catch (error: any) {
      console.error("Erro ao adicionar foto:", error);
      toast.error("Erro ao adicionar foto: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover esta foto do guia?")) return;

    try {
      const { error } = await supabase
        .from("measurement_guide_photos" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Foto removida do guia!");
      fetchGuidePhotos();
    } catch (error: any) {
      toast.error("Erro ao remover: " + error.message);
    }
  };

  const resetForm = () => {
    setFormData({ title: "", description: "", order_index: "" });
    setSelectedFile(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard/trade/shelf-measurements")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <HelpCircle className="h-8 w-8" />
                Como Medir Prateleiras
              </h1>
              <p className="text-muted-foreground">
                Guia visual com instruções passo a passo para realizar medições corretas
              </p>
            </div>
          </div>
          
          {isAdminOrSupervisor && (
            <Button onClick={() => setDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Adicionar Instrução
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando guia...</p>
          </div>
        ) : photos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ImageIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma instrução cadastrada ainda</p>
              {isAdminOrSupervisor && (
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Adicionar Primeira Instrução
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {photos.map((photo, index) => (
              <Card key={photo.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <CardTitle>{photo.title}</CardTitle>
                        {photo.description && (
                          <CardDescription className="mt-1">
                            {photo.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    {isAdminOrSupervisor && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(photo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <img
                    src={photo.photo_url}
                    alt={photo.title}
                    className="w-full rounded-lg shadow-lg"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog para adicionar foto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Instrução ao Guia</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título da Instrução *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Como medir a largura total da prateleira"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Explicação detalhada do passo..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order">Ordem de Exibição</Label>
              <Input
                id="order"
                type="number"
                min="1"
                value={formData.order_index}
                onChange={(e) => setFormData(prev => ({ ...prev, order_index: e.target.value }))}
                placeholder="Ex: 1, 2, 3..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo">Foto da Instrução *</Label>
              <Input
                id="photo"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Arquivo selecionado: {selectedFile.name}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={uploading}>
              {uploading ? "Enviando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default TradeMeasurementGuide;
