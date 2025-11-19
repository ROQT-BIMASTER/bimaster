import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Download, Copy, Upload, Video, Globe, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type MediaType = 'image' | 'video';

export function AIImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState("1024x1024");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [videoLength, setVideoLength] = useState("5");
  const [resolution, setResolution] = useState("720p");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateImage = async () => {
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

  const handleGenerateVideo = async (fromImage: boolean = false) => {
    if (!prompt.trim() && !fromImage) {
      toast.error("Digite uma descrição para gerar o vídeo");
      return;
    }

    if (fromImage && !uploadedImage) {
      toast.error("Faça upload de uma imagem primeiro");
      return;
    }

    setLoading(true);
    setProgress(0);
    try {
      const { data, error } = await supabase.functions.invoke('pollo-generate-video', {
        body: { 
          prompt,
          image: fromImage ? uploadedImage : undefined,
          length: parseInt(videoLength),
          resolution
        }
      });

      if (error) throw error;

      if (data?.taskId) {
        setTaskId(data.taskId);
        toast.info("Vídeo sendo processado...");
        pollVideoStatus(data.taskId);
      } else {
        throw new Error("Task ID não encontrado");
      }
    } catch (error: any) {
      console.error('Erro ao gerar vídeo:', error);
      toast.error(error.message || "Erro ao gerar vídeo");
      setLoading(false);
    }
  };

  const pollVideoStatus = async (id: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('pollo-check-status', {
          body: { taskId: id }
        });

        if (error) throw error;

        attempts++;
        setProgress((attempts / maxAttempts) * 100);

        if (data?.status === 'completed' && data?.videoUrl) {
          clearInterval(interval);
          setVideoUrl(data.videoUrl);
          setLoading(false);
          setProgress(100);
          toast.success("Vídeo gerado com sucesso!");
        } else if (data?.status === 'failed') {
          clearInterval(interval);
          setLoading(false);
          toast.error("Falha ao gerar vídeo");
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setLoading(false);
          toast.error("Timeout ao gerar vídeo");
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    }, 5000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, envie apenas imagens");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setUploadedImage(base64);
      toast.success("Imagem carregada com sucesso!");
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async (url: string, type: MediaType) => {
    if (!url) return;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const urlObj = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = `pollo-ai-${type}-${Date.now()}.${type === 'video' ? 'mp4' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(urlObj);
      document.body.removeChild(a);
      toast.success("Download iniciado!");
    } catch (error) {
      toast.error(`Erro ao fazer download do ${type === 'video' ? 'vídeo' : 'imagem'}`);
    }
  };

  const handleCopyUrl = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
  };

  const handleAnalyzeWebsite = async () => {
    if (!websiteUrl.trim()) {
      toast.error("Digite uma URL válida");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pollo-analyze-website', {
        body: { url: websiteUrl }
      });

      if (error) throw error;

      if (data?.analysis) {
        toast.success("Site analisado com sucesso!");
        setPrompt(data.analysis);
      }
    } catch (error: any) {
      console.error('Erro ao analisar site:', error);
      toast.error(error.message || "Erro ao analisar site");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Gerador Avançado de IA - Pollo.ai
        </CardTitle>
        <CardDescription>
          Crie imagens e vídeos profissionais usando IA. Suporte para texto, imagens e análise de sites.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="image" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="image">
              <ImageIcon className="h-4 w-4 mr-2" />
              Imagem
            </TabsTrigger>
            <TabsTrigger value="video">
              <Video className="h-4 w-4 mr-2" />
              Vídeo
            </TabsTrigger>
            <TabsTrigger value="image-to-video">
              <Upload className="h-4 w-4 mr-2" />
              Img → Vídeo
            </TabsTrigger>
            <TabsTrigger value="website">
              <Globe className="h-4 w-4 mr-2" />
              Site
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="image-prompt">Descrição da imagem</Label>
              <Textarea
                id="image-prompt"
                placeholder="Ex: Uma cidade futurista ao pôr do sol..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px]"
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
              onClick={handleGenerateImage} 
              disabled={loading || !prompt.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Imagem
                </>
              )}
            </Button>

            {imageUrl && (
              <div className="space-y-4">
                <div className="rounded-lg border overflow-hidden bg-muted">
                  <img src={imageUrl} alt="Imagem gerada" className="w-full h-auto" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleDownload(imageUrl, 'image')} className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="outline" onClick={() => handleCopyUrl(imageUrl)} className="flex-1">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar URL
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="video" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="video-prompt">Descrição do vídeo</Label>
              <Textarea
                id="video-prompt"
                placeholder="Ex: Um drone voando sobre uma floresta tropical..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px]"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolução</Label>
                <Select value={resolution} onValueChange={setResolution} disabled={loading}>
                  <SelectTrigger id="resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="720p">720p (HD)</SelectItem>
                    <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="length">Duração (segundos)</Label>
                <Select value={videoLength} onValueChange={setVideoLength} disabled={loading}>
                  <SelectTrigger id="length">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 segundos</SelectItem>
                    <SelectItem value="5">5 segundos</SelectItem>
                    <SelectItem value="10">10 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading && progress > 0 && (
              <div className="space-y-2">
                <Label>Progresso</Label>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            <Button 
              onClick={() => handleGenerateVideo(false)} 
              disabled={loading || !prompt.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando vídeo...
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  Gerar Vídeo
                </>
              )}
            </Button>

            {videoUrl && (
              <div className="space-y-4">
                <div className="rounded-lg border overflow-hidden bg-muted">
                  <video src={videoUrl} controls className="w-full h-auto" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleDownload(videoUrl, 'video')} className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="outline" onClick={() => handleCopyUrl(videoUrl)} className="flex-1">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar URL
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="image-to-video" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Upload de Imagem</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                Selecionar Imagem
              </Button>
            </div>

            {uploadedImage && (
              <div className="rounded-lg border overflow-hidden bg-muted">
                <img src={uploadedImage} alt="Imagem carregada" className="w-full h-auto max-h-64 object-contain" />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="img-video-prompt">Descrição do movimento (opcional)</Label>
              <Textarea
                id="img-video-prompt"
                placeholder="Ex: Câmera se aproximando lentamente..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[80px]"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Resolução</Label>
                <Select value={resolution} onValueChange={setResolution} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="720p">720p (HD)</SelectItem>
                    <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Duração</Label>
                <Select value={videoLength} onValueChange={setVideoLength} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 segundos</SelectItem>
                    <SelectItem value="5">5 segundos</SelectItem>
                    <SelectItem value="10">10 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading && progress > 0 && (
              <div className="space-y-2">
                <Label>Progresso</Label>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            <Button 
              onClick={() => handleGenerateVideo(true)} 
              disabled={loading || !uploadedImage}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando vídeo...
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  Transformar em Vídeo
                </>
              )}
            </Button>

            {videoUrl && (
              <div className="space-y-4">
                <div className="rounded-lg border overflow-hidden bg-muted">
                  <video src={videoUrl} controls className="w-full h-auto" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleDownload(videoUrl, 'video')} className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="outline" onClick={() => handleCopyUrl(videoUrl)} className="flex-1">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar URL
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="website" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="website-url">URL do Site</Label>
              <Input
                id="website-url"
                type="url"
                placeholder="https://exemplo.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                disabled={loading}
              />
            </div>

            <Button 
              onClick={handleAnalyzeWebsite} 
              disabled={loading || !websiteUrl.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Globe className="mr-2 h-4 w-4" />
                  Analisar Site
                </>
              )}
            </Button>

            {prompt && (
              <div className="space-y-2">
                <Label>Análise do Site</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px]"
                  disabled={loading}
                />
                <p className="text-sm text-muted-foreground">
                  Use essa análise nas outras abas para gerar conteúdo baseado no site
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}