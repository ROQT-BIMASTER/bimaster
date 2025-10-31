import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ProdutoConcorrenteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ProdutoConcorrenteDialog({ 
  open, 
  onOpenChange, 
  onSuccess 
}: ProdutoConcorrenteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    competitor_id: "",
    product_name: "",
    category: "",
    price: "",
    description: "",
    market_presence: "medio",
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photosPreviews, setPhotosPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      fetchCompetitors();
    }
  }, [open]);

  const fetchCompetitors = async () => {
    const { data } = await supabase
      .from("competitors")
      .select("id, name, brand")
      .eq("active", true)
      .order("name");
    
    if (data) setCompetitors(data);
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (photos.length + files.length > 5) {
      toast.error("Máximo de 5 fotos por produto");
      return;
    }

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} é muito grande. Máximo 5MB.`);
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} não é uma imagem válida`);
        return;
      }
    }

    setPhotos([...photos, ...files]);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotosPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
    setPhotosPreviews(photosPreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUploadingPhotos(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Upload das fotos
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const fileExt = photo.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `competitor-products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('trade-photos')
          .upload(filePath, photo);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('trade-photos')
          .getPublicUrl(filePath);

        photoUrls.push(publicUrl);
      }

      setUploadingPhotos(false);

      // Inserir produto concorrente
      const { error } = await supabase
        .from("competitor_products")
        .insert({
          competitor_id: formData.competitor_id,
          product_name: formData.product_name,
          category: formData.category || null,
          price: formData.price ? parseFloat(formData.price) : null,
          description: formData.description || null,
          market_presence: formData.market_presence,
          photos: photoUrls,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success("Produto concorrente cadastrado!");
      onSuccess();
      onOpenChange(false);
      
      // Reset
      setFormData({
        competitor_id: "",
        product_name: "",
        category: "",
        price: "",
        description: "",
        market_presence: "medio",
      });
      setPhotos([]);
      setPhotosPreviews([]);
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao cadastrar produto");
    } finally {
      setLoading(false);
      setUploadingPhotos(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Produto Concorrente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="competitor_id">
              Concorrente <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.competitor_id}
              onValueChange={(value) => setFormData({ ...formData, competitor_id: value })}
              required
            >
              <SelectTrigger id="competitor_id">
                <SelectValue placeholder="Selecione o concorrente" />
              </SelectTrigger>
              <SelectContent>
                {competitors.map((comp) => (
                  <SelectItem key={comp.id} value={comp.id}>
                    {comp.name} {comp.brand && `(${comp.brand})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product_name">
                Nome do Produto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product_name"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                placeholder="Ex: Cola Zero 350ml"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Bebidas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="market_presence">Presença de Mercado</Label>
              <Select
                value={formData.market_presence}
                onValueChange={(value) => setFormData({ ...formData, market_presence: value })}
              >
                <SelectTrigger id="market_presence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="medio">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Características do produto concorrente..."
              rows={3}
            />
          </div>

          {/* Upload de Fotos */}
          <div className="space-y-3">
            <Label>Fotos do Produto (até 5)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoAdd}
                disabled={photos.length >= 5 || uploadingPhotos}
                className="cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">
                {photos.length}/5
              </span>
            </div>

            {photosPreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {photosPreviews.map((preview, index) => (
                  <Card key={index} className="relative group">
                    <img 
                      src={preview} 
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removePhoto(index)}
                      aria-label="Remover foto"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || uploadingPhotos}>
              {uploadingPhotos ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando fotos...
                </>
              ) : loading ? (
                "Salvando..."
              ) : (
                "Cadastrar Produto"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
