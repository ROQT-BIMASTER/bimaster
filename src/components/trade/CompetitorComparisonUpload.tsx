import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Target, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CompetitorComparisonUploadProps {
  competitorId: string;
  onPhotosUploaded: () => void;
}

export const CompetitorComparisonUpload = ({ 
  competitorId, 
  onPhotosUploaded 
}: CompetitorComparisonUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [competitorPhotos, setCompetitorPhotos] = useState<string[]>([]);
  const [ourPhotos, setOurPhotos] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    photoType: 'competitor' | 'our_product'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Você precisa estar logado");
        return;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `competitor-comparison/${photoType}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("trade-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Armazenar apenas o caminho (path) por segurança
      const { error: insertError } = await supabase
        .from("competitor_comparison_photos")
        .insert({
          competitor_id: competitorId,
          photo_url: filePath,
          photo_type: photoType,
          created_by: userData.user.id,
        });

      if (insertError) throw insertError;

      if (photoType === 'competitor') {
        setCompetitorPhotos(prev => [...prev, filePath]);
      } else {
        setOurPhotos(prev => [...prev, filePath]);
      }

      toast.success("Foto enviada com sucesso!");
      onPhotosUploaded();
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyzeComparison = async () => {
    if (competitorPhotos.length === 0 || ourPhotos.length === 0) {
      toast.error("Adicione pelo menos uma foto de cada tipo para comparar");
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-shelf-photos', {
        body: { 
          photos: [...competitorPhotos, ...ourPhotos],
          comparison_mode: true,
          competitor_id: competitorId,
        }
      });

      if (error) throw error;

      toast.success("Análise comparativa gerada com sucesso!");
      
      // Criar insight com os resultados
      await supabase.from("ai_insights").insert({
        title: "Análise Comparativa de Concorrente",
        description: data.insights,
        insight_type: "recommendation",
        category: "competitor_analysis",
        entity_type: "competitor",
        entity_id: competitorId,
        priority: "alta",
        impact_level: "high",
        status: "new",
        confidence_score: data.compliance_score,
        data_points: {
          photo_urls: [...competitorPhotos, ...ourPhotos],
          comparison_data: data,
        }
      });

      toast.info("Veja os insights na tela de Insights de IA");
    } catch (error: any) {
      console.error("Erro ao analisar:", error);
      toast.error("Erro ao gerar análise: " + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparação Visual de Produtos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-destructive" />
              Fotos do Concorrente
            </h3>
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById('upload-competitor')?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Enviando..." : "Upload Foto Concorrente"}
              </Button>
              <input
                id="upload-competitor"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpload(e, 'competitor')}
              />
              {competitorPhotos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {competitorPhotos.map((url, idx) => (
                    <img 
                      key={idx}
                      src={url} 
                      alt={`Concorrente ${idx + 1}`}
                      className="rounded-lg w-full h-24 object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Fotos dos Nossos Produtos
            </h3>
            <div className="space-y-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById('upload-our-product')?.click()}
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Enviando..." : "Upload Nosso Produto"}
              </Button>
              <input
                id="upload-our-product"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpload(e, 'our_product')}
              />
              {ourPhotos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {ourPhotos.map((url, idx) => (
                    <img 
                      key={idx}
                      src={url} 
                      alt={`Nosso produto ${idx + 1}`}
                      className="rounded-lg w-full h-24 object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Button 
            className="w-full" 
            variant="default"
            onClick={handleAnalyzeComparison}
            disabled={analyzing || competitorPhotos.length === 0 || ourPhotos.length === 0}
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analisando com IA...
              </>
            ) : (
              <>
                <Target className="mr-2 h-4 w-4" />
                Gerar Análise Comparativa com IA
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            A IA irá comparar preços, posicionamento, share de gôndola e outras métricas
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
