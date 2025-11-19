import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Download, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AIImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState("1024x1024");

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Digite uma descrição para gerar a imagem");
      return;
    }

    setLoading(true);
    try {
      const [width, height] = dimensions.split('x').map(Number);
      
      const { data, error } = await supabase.functions.invoke('pollo-generate-image', {
        body: { prompt, width, height }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
        toast.success("Imagem gerada com sucesso!");
      } else {
        throw new Error("URL da imagem não encontrada na resposta");
      }
    } catch (error: any) {
      console.error('Erro ao gerar imagem:', error);
      toast.error(error.message || "Erro ao gerar imagem");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pollo-ai-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Download iniciado!");
    } catch (error) {
      toast.error("Erro ao fazer download da imagem");
    }
  };

  const handleCopyUrl = () => {
    if (!imageUrl) return;
    navigator.clipboard.writeText(imageUrl);
    toast.success("URL copiada!");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Gerador de Imagens com IA
        </CardTitle>
        <CardDescription>
          Crie imagens profissionais usando inteligência artificial da Pollo.ai
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Descrição da imagem</Label>
            <Textarea
              id="prompt"
              placeholder="Descreva a imagem que você quer criar. Ex: Uma vista aérea de uma cidade moderna ao pôr do sol, com arranha-céus iluminados..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[120px]"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dimensions">Dimensões</Label>
            <Select value={dimensions} onValueChange={setDimensions} disabled={loading}>
              <SelectTrigger id="dimensions">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1024x1024">Quadrado (1024x1024)</SelectItem>
                <SelectItem value="1536x1024">Paisagem (1536x1024)</SelectItem>
                <SelectItem value="1024x1536">Retrato (1024x1536)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={loading || !prompt.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando imagem...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Gerar Imagem
              </>
            )}
          </Button>
        </div>

        {imageUrl && (
          <div className="space-y-4">
            <div className="rounded-lg border overflow-hidden bg-muted">
              <img 
                src={imageUrl} 
                alt="Imagem gerada" 
                className="w-full h-auto"
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleDownload}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCopyUrl}
                className="flex-1"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar URL
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}