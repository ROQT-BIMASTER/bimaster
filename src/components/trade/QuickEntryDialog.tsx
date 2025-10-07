import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Store, Calendar, Camera, Tag, Upload, Sparkles, 
  CheckCircle2, Loader2, ArrowRight, ImagePlus 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface QuickEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const QuickEntryDialog = ({ open, onOpenChange, onSuccess }: QuickEntryDialogProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    // Visita
    store_id: "",
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    visit_type: "routine",
    
    // Fotos e Análise
    photos: [] as File[],
    ai_insights: "",
    
    // Shelf Share
    products_found: [] as string[],
    our_facings: 0,
    competitor_facings: 0,
    
    // Promoções
    promotion_id: "",
    promotion_active: false,
    materials_present: [] as string[],
    
    // Observações
    notes: "",
    issues_found: [] as string[],
  });

  useEffect(() => {
    if (open) {
      fetchInitialData();
    }
  }, [open]);

  const fetchInitialData = async () => {
    try {
      const [storesData, productsData, promotionsData] = await Promise.all([
        supabase.from("stores").select("*").eq("status", "active").order("name"),
        supabase.from("products").select("*").eq("active", true).eq("is_our_product", true),
        supabase.from("promotions").select("*").eq("status", "active"),
      ]);

      if (storesData.data) setStores(storesData.data);
      if (productsData.data) setProducts(productsData.data);
      if (promotionsData.data) setPromotions(promotionsData.data);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const newPhotos = Array.from(files);
    setFormData(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos] }));
    
    // Trigger AI analysis
    await analyzePhotosWithAI(newPhotos);
  };

  const analyzePhotosWithAI = async (photos: File[]) => {
    setAnalyzing(true);
    toast.info("🤖 Analisando fotos com IA...");

    try {
      // Convert photos to base64 for AI analysis
      const photoData = await Promise.all(
        photos.map(async (photo) => {
          const reader = new FileReader();
          return new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(photo);
          });
        })
      );

      const { data, error } = await supabase.functions.invoke('analyze-shelf-photos', {
        body: { photos: photoData }
      });

      if (error) throw error;

      if (data) {
        setFormData(prev => ({
          ...prev,
          ai_insights: data.insights,
          products_found: data.products_detected || [],
          our_facings: data.our_facings || 0,
          competitor_facings: data.competitor_facings || 0,
          issues_found: data.issues || [],
        }));

        toast.success("✨ Análise concluída! Dados preenchidos automaticamente.");
      }
    } catch (error) {
      console.error("Erro na análise:", error);
      toast.error("Erro ao analisar fotos. Continue manualmente.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Create visit
      const visitCode = `V-${Date.now()}`;
      const { data: visit, error: visitError } = await supabase
        .from("visits")
        .insert({
          visit_code: visitCode,
          store_id: formData.store_id,
          user_id: user.id,
          scheduled_date: formData.visit_date,
          scheduled_time: formData.visit_time,
          visit_type: formData.visit_type,
          status: "completed",
          notes: formData.notes,
          check_in_time: new Date().toISOString(),
          check_out_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (visitError) throw visitError;

      // 2. Upload photos and create records
      for (const photo of formData.photos) {
        const fileName = `${visit.id}/${Date.now()}-${photo.name}`;
        const { error: uploadError } = await supabase.storage
          .from('trade-photos')
          .upload(fileName, photo);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('trade-photos')
            .getPublicUrl(fileName);

          await supabase.from("photos").insert({
            visit_id: visit.id,
            store_id: formData.store_id,
            photo_url: publicUrl,
            photo_type: "shelf",
            ai_processed: true,
            ai_analysis: { insights: formData.ai_insights },
          });
        }
      }

      // 3. Create shelf share records
      if (formData.products_found.length > 0) {
        for (const productId of formData.products_found) {
          await supabase.from("shelf_share").insert({
            visit_id: visit.id,
            store_id: formData.store_id,
            product_id: productId,
            quantity_facings: formData.our_facings,
            in_stock: true,
          });
        }
      }

      // 4. Create promotion execution record
      if (formData.promotion_id && formData.promotion_active) {
        await supabase.from("promotion_execution").insert({
          visit_id: visit.id,
          store_id: formData.store_id,
          promotion_id: formData.promotion_id,
          is_active: formData.promotion_active,
          materials_present: formData.materials_present,
        });
      }

      toast.success("✅ Lançamento concluído com sucesso!");
      onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Erro no lançamento:", error);
      toast.error("Erro ao salvar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({
      store_id: "",
      visit_date: new Date().toISOString().split('T')[0],
      visit_time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      visit_type: "routine",
      photos: [],
      ai_insights: "",
      products_found: [],
      our_facings: 0,
      competitor_facings: 0,
      promotion_id: "",
      promotion_active: false,
      materials_present: [],
      notes: "",
      issues_found: [],
    });
  };

  const progress = (currentStep / 4) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Lançamento Rápido Inteligente
          </DialogTitle>
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              Passo {currentStep} de 4 - {progress.toFixed(0)}% concluído
            </p>
          </div>
        </DialogHeader>

        <Tabs value={`step${currentStep}`} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="step1" disabled={currentStep !== 1}>
              <Store className="h-4 w-4 mr-2" />
              PDV
            </TabsTrigger>
            <TabsTrigger value="step2" disabled={currentStep !== 2}>
              <Camera className="h-4 w-4 mr-2" />
              Fotos + IA
            </TabsTrigger>
            <TabsTrigger value="step3" disabled={currentStep !== 3}>
              <Tag className="h-4 w-4 mr-2" />
              Dados
            </TabsTrigger>
            <TabsTrigger value="step4" disabled={currentStep !== 4}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Revisão
            </TabsTrigger>
          </TabsList>

          {/* Step 1: Selecionar PDV */}
          <TabsContent value="step1" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Visita</CardTitle>
                <CardDescription>Selecione o PDV e detalhes da visita</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>PDV / Loja *</Label>
                    <Select value={formData.store_id} onValueChange={(value) => setFormData(prev => ({ ...prev, store_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o PDV" />
                      </SelectTrigger>
                      <SelectContent>
                        {stores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name} - {store.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Visita</Label>
                    <Select value={formData.visit_type} onValueChange={(value) => setFormData(prev => ({ ...prev, visit_type: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine">Rotina</SelectItem>
                        <SelectItem value="audit">Auditoria</SelectItem>
                        <SelectItem value="promotion">Promoção</SelectItem>
                        <SelectItem value="merchandising">Merchandising</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data da Visita</Label>
                    <Input
                      type="date"
                      value={formData.visit_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, visit_date: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Hora</Label>
                    <Input
                      type="time"
                      value={formData.visit_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, visit_time: e.target.value }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => setCurrentStep(2)} disabled={!formData.store_id}>
                Próximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Step 2: Upload de Fotos + IA */}
          <TabsContent value="step2" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Análise Inteligente com IA
                </CardTitle>
                <CardDescription>
                  Tire fotos do PDV e deixe a IA analisar automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e.target.files)}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      <ImagePlus className="h-12 w-12 text-muted-foreground" />
                      <p className="text-sm font-medium">Clique para adicionar fotos</p>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG ou WEBP (máx. 10 fotos)
                      </p>
                    </div>
                  </label>
                </div>

                {analyzing && (
                  <div className="flex items-center justify-center gap-2 p-4 bg-primary/10 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <p className="text-sm font-medium">Analisando fotos com IA...</p>
                  </div>
                )}

                {formData.photos.length > 0 && (
                  <div className="space-y-2">
                    <Label>Fotos Adicionadas ({formData.photos.length})</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {formData.photos.map((photo, index) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formData.ai_insights && (
                  <Card className="bg-primary/5">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Insights da IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{formData.ai_insights}</p>
                      {formData.issues_found.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-semibold">Problemas Detectados:</p>
                          {formData.issues_found.map((issue, i) => (
                            <Badge key={i} variant="destructive" className="mr-2">
                              {issue}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Voltar
              </Button>
              <Button onClick={() => setCurrentStep(3)}>
                Próximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Step 3: Dados de Shelf Share e Promoção */}
          <TabsContent value="step3" className="space-y-4">
            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Share de Gôndola</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Faces Nossas</Label>
                      <Input
                        type="number"
                        value={formData.our_facings}
                        onChange={(e) => setFormData(prev => ({ ...prev, our_facings: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Faces Concorrentes</Label>
                      <Input
                        type="number"
                        value={formData.competitor_facings}
                        onChange={(e) => setFormData(prev => ({ ...prev, competitor_facings: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Promoção Ativa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selecione a Promoção</Label>
                    <Select value={formData.promotion_id} onValueChange={(value) => setFormData(prev => ({ ...prev, promotion_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhuma promoção" />
                      </SelectTrigger>
                      <SelectContent>
                        {promotions.map((promo) => (
                          <SelectItem key={promo.id} value={promo.id}>
                            {promo.name} - {promo.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Voltar
              </Button>
              <Button onClick={() => setCurrentStep(4)}>
                Próximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Step 4: Revisão e Observações */}
          <TabsContent value="step4" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Observações Finais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Observações da Visita</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Adicione observações gerais sobre a visita..."
                    rows={4}
                  />
                </div>

                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-sm">Resumo do Lançamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>PDV:</span>
                      <span className="font-medium">
                        {stores.find(s => s.id === formData.store_id)?.name || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fotos:</span>
                      <span className="font-medium">{formData.photos.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Faces (Nossas/Concorrentes):</span>
                      <span className="font-medium">
                        {formData.our_facings} / {formData.competitor_facings}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Promoção:</span>
                      <span className="font-medium">
                        {formData.promotion_id ? "Sim" : "Não"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Concluir Lançamento
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
