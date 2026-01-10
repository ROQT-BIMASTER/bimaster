import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Video, Image, Sparkles, Camera, Box, Film, Download, Copy, Plus, Trash2, RefreshCw, Play, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Scene {
  description: string;
  duration: number;
}

interface BrandGuidelines {
  colors: string[];
  style: string;
  tone: string;
}

interface GeneratedVideo {
  videoUrl: string;
  script: {
    hook: string;
    action: string;
    benefit: string;
    cta: string;
    fullScript: string;
  };
  metadata: {
    type: string;
    format: string;
    style: string;
    duration: number;
    productName?: string;
    generatedAt: string;
  };
}

const creativeTypes = [
  { id: 'text-to-video', label: 'Text to Video', icon: Video, description: 'Criar vídeo a partir de descrição' },
  { id: 'image-to-video', label: 'Image to Video', icon: Image, description: 'Animar foto de produto' },
  { id: 'ugc-style', label: 'UGC Style', icon: Camera, description: 'Estilo gravado por celular' },
  { id: 'mockup-3d', label: 'Mockup 3D', icon: Box, description: 'Rotação 3D do produto' },
  { id: 'multi-scene', label: 'Multi-Cenas', icon: Film, description: 'Vídeo com múltiplas cenas' },
];

const formats = [
  { value: '9:16', label: '9:16 (Reels/TikTok)' },
  { value: '16:9', label: '16:9 (YouTube/Banner)' },
  { value: '1:1', label: '1:1 (Feed Instagram)' },
];

const styles = [
  { value: 'professional', label: 'Profissional' },
  { value: 'ugc', label: 'UGC Autêntico' },
  { value: 'cinematic', label: 'Cinematográfico' },
  { value: 'minimal', label: 'Minimalista' },
  { value: 'energetic', label: 'Energético' },
];

const durations = [
  { value: 5, label: '5 segundos' },
  { value: 10, label: '10 segundos' },
];

export const NanoBananaVideoEngine = () => {
  const [activeType, setActiveType] = useState('text-to-video');
  const [prompt, setPrompt] = useState('');
  const [productName, setProductName] = useState('');
  const [format, setFormat] = useState('9:16');
  const [style, setStyle] = useState('professional');
  const [duration, setDuration] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null);
  
  // Image upload state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Brand guidelines
  const [brandGuidelines, setBrandGuidelines] = useState<BrandGuidelines>({
    colors: [],
    style: '',
    tone: ''
  });
  const [newColor, setNewColor] = useState('#000000');
  
  // Multi-scene state
  const [scenes, setScenes] = useState<Scene[]>([
    { description: '', duration: 3 },
    { description: '', duration: 4 },
    { description: '', duration: 3 },
  ]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      convertToBase64(file);
    }
  }, []);

  const convertToBase64 = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setUploadedImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      convertToBase64(file);
    }
  };

  const addColor = () => {
    if (newColor && !brandGuidelines.colors.includes(newColor)) {
      setBrandGuidelines(prev => ({
        ...prev,
        colors: [...prev.colors, newColor]
      }));
    }
  };

  const removeColor = (color: string) => {
    setBrandGuidelines(prev => ({
      ...prev,
      colors: prev.colors.filter(c => c !== color)
    }));
  };

  const updateScene = (index: number, field: keyof Scene, value: string | number) => {
    setScenes(prev => prev.map((scene, i) => 
      i === index ? { ...scene, [field]: value } : scene
    ));
  };

  const addScene = () => {
    if (scenes.length < 5) {
      setScenes(prev => [...prev, { description: '', duration: 3 }]);
    }
  };

  const removeScene = (index: number) => {
    if (scenes.length > 2) {
      setScenes(prev => prev.filter((_, i) => i !== index));
    }
  };

  const generateVideo = async () => {
    if (!prompt) {
      toast.error('Adicione um prompt para gerar o vídeo');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus('Preparando geração de vídeo...');

    try {
      // Etapa 1: Obter prompt otimizado da edge function
      setGenerationProgress(10);
      setGenerationStatus('Otimizando prompt para vídeo...');

      const { data, error } = await supabase.functions.invoke('nano-banana-video', {
        body: {
          type: activeType,
          prompt,
          productName: productName || undefined,
          brandGuidelines: brandGuidelines.colors.length > 0 || brandGuidelines.style ? brandGuidelines : undefined,
          imageUrl: uploadedImage || undefined,
          scenes: activeType === 'multi-scene' ? scenes.filter(s => s.description) : undefined,
          format,
          style,
          duration
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setGenerationProgress(30);
      setGenerationStatus('Gerando vídeo com IA (isso pode levar alguns minutos)...');

      // Etapa 2: Gerar vídeo usando a API de geração de vídeo
      const videoResponse = await generateVideoWithAPI(
        data.videoPrompt,
        format,
        duration,
        uploadedImage || undefined
      );

      if (!videoResponse.success || !videoResponse.videoUrl) {
        throw new Error(videoResponse.error || 'Falha ao gerar vídeo');
      }

      setGenerationProgress(100);
      setGenerationStatus('Vídeo gerado com sucesso!');

      setGeneratedVideo({
        videoUrl: videoResponse.videoUrl,
        script: data.script,
        metadata: data.metadata
      });

      toast.success('🎬 Vídeo gerado com sucesso!');

    } catch (error: any) {
      console.error('Erro ao gerar vídeo:', error);
      toast.error(error.message || 'Erro ao gerar vídeo');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationStatus('');
    }
  };

  // Função para gerar vídeo usando edge function que chama videogen
  const generateVideoWithAPI = async (
    videoPrompt: string,
    aspectRatio: string,
    videoDuration: number,
    startingFrame?: string
  ): Promise<{ success: boolean; videoUrl?: string; error?: string }> => {
    try {
      // Chamar edge function que usa o videogen
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: videoPrompt,
          aspectRatio,
          duration: videoDuration,
          startingFrame,
          resolution: '1080p',
          cameraFixed: style === 'minimal' || style === 'professional'
        }
      });

      if (error) {
        console.error('Erro edge function:', error);
        return { success: false, error: error.message };
      }

      if (data.error) {
        return { success: false, error: data.error };
      }

      return { success: true, videoUrl: data.videoUrl };
    } catch (err: any) {
      console.error('Erro ao chamar API de vídeo:', err);
      return { success: false, error: err.message };
    }
  };

  const downloadVideo = () => {
    if (!generatedVideo?.videoUrl) return;
    
    const link = document.createElement('a');
    link.href = generatedVideo.videoUrl;
    link.download = `nano-banana-${productName || 'video'}-${Date.now()}.mp4`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Download iniciado!');
  };

  const copyScript = () => {
    if (!generatedVideo?.script?.fullScript) return;
    navigator.clipboard.writeText(generatedVideo.script.fullScript);
    toast.success('Roteiro copiado!');
  };

  const resetAll = () => {
    setPrompt('');
    setProductName('');
    setUploadedImage(null);
    setGeneratedVideo(null);
    setScenes([
      { description: '', duration: 3 },
      { description: '', duration: 4 },
      { description: '', duration: 3 },
    ]);
    setBrandGuidelines({ colors: [], style: '', tone: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Nano Banana Video Engine
          </h2>
          <p className="text-muted-foreground">
            Gere vídeos de produto com IA
          </p>
        </div>
        {generatedVideo && (
          <Button variant="outline" onClick={resetAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Novo Vídeo
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Painel de Configuração */}
        <div className="space-y-4">
          {/* Tipo de Criativo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Tipo de Vídeo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {creativeTypes.map((type) => (
                  <Button
                    key={type.id}
                    variant={activeType === type.id ? "default" : "outline"}
                    className="h-auto py-3 flex flex-col items-center gap-1"
                    onClick={() => setActiveType(type.id)}
                    disabled={isGenerating}
                  >
                    <type.icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{type.label}</span>
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {creativeTypes.find(t => t.id === activeType)?.description}
              </p>
            </CardContent>
          </Card>

          {/* Produto e Prompt */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Briefing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="productName">Nome do Produto</Label>
                <Input
                  id="productName"
                  placeholder="Ex: Shampoo Premium Ruby Rose"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  disabled={isGenerating}
                />
              </div>
              
              <div>
                <Label htmlFor="prompt">Descrição do Vídeo</Label>
                <Textarea
                  id="prompt"
                  placeholder="Descreva o que você quer ver no vídeo... Ex: Produto girando lentamente com partículas douradas ao redor"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[100px]"
                  disabled={isGenerating}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Formato</Label>
                  <Select value={format} onValueChange={setFormat} disabled={isGenerating}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formats.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estilo</Label>
                  <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {styles.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duração</Label>
                  <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))} disabled={isGenerating}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {durations.map((d) => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upload de Imagem */}
          {['image-to-video', 'ugc-style'].includes(activeType) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Imagem Inicial (opcional)</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors relative ${
                    isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                >
                  {uploadedImage ? (
                    <div className="space-y-2">
                      <img 
                        src={uploadedImage} 
                        alt="Uploaded" 
                        className="max-h-32 mx-auto rounded-lg"
                      />
                      <Button variant="outline" size="sm" onClick={() => setUploadedImage(null)} disabled={isGenerating}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Image className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Arraste uma imagem ou clique para selecionar
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isGenerating}
                      />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Multi-Cenas */}
          {activeType === 'multi-scene' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  Cenas do Vídeo
                  <Button variant="outline" size="sm" onClick={addScene} disabled={scenes.length >= 5 || isGenerating}>
                    <Plus className="mr-1 h-4 w-4" />
                    Cena
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {scenes.map((scene, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Label className="text-xs">Cena {index + 1}</Label>
                      <Textarea
                        placeholder={index === 0 ? "Hook - capturar atenção" : index === scenes.length - 1 ? "CTA - chamada para ação" : "Ação/Benefício"}
                        value={scene.description}
                        onChange={(e) => updateScene(index, 'description', e.target.value)}
                        className="min-h-[60px] text-sm"
                        disabled={isGenerating}
                      />
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">Duração</Label>
                      <Select 
                        value={String(scene.duration)} 
                        onValueChange={(v) => updateScene(index, 'duration', Number(v))}
                        disabled={isGenerating}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4, 5, 6].map((d) => (
                            <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {scenes.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-5"
                        onClick={() => removeScene(index)}
                        disabled={isGenerating}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Brand Guidelines */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Diretrizes de Marca (Opcional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Cores da Marca</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-12 h-9 p-1 cursor-pointer"
                    disabled={isGenerating}
                  />
                  <Button variant="outline" size="sm" onClick={addColor} disabled={isGenerating}>
                    <Plus className="mr-1 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
                {brandGuidelines.colors.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {brandGuidelines.colors.map((color) => (
                      <Badge
                        key={color}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => !isGenerating && removeColor(color)}
                      >
                        <div 
                          className="w-3 h-3 rounded-full mr-1" 
                          style={{ backgroundColor: color }}
                        />
                        {color}
                        <Trash2 className="ml-1 h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Estilo de Marca</Label>
                <Input
                  placeholder="Ex: Moderno, sofisticado, jovem..."
                  value={brandGuidelines.style}
                  onChange={(e) => setBrandGuidelines(prev => ({ ...prev, style: e.target.value }))}
                  disabled={isGenerating}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botão Gerar */}
          <Button 
            className="w-full h-12 text-lg" 
            onClick={generateVideo}
            disabled={isGenerating || !prompt}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Gerando Vídeo...
              </>
            ) : (
              <>
                <Video className="mr-2 h-5 w-5" />
                Gerar Vídeo
              </>
            )}
          </Button>

          {/* Progress Bar */}
          {isGenerating && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{generationStatus}</span>
                    <span className="font-medium">{generationProgress}%</span>
                  </div>
                  <Progress value={generationProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    A geração de vídeo pode levar de 1 a 5 minutos
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Painel de Preview */}
        <div className="space-y-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Play className="h-5 w-5" />
                Preview do Vídeo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedVideo ? (
                <>
                  {/* Video Player */}
                  <div className="aspect-[9/16] max-h-[500px] mx-auto bg-black rounded-lg overflow-hidden">
                    <video 
                      src={generatedVideo.videoUrl} 
                      controls 
                      autoPlay
                      loop
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button onClick={downloadVideo} className="flex-1">
                      <Download className="mr-2 h-4 w-4" />
                      Download MP4
                    </Button>
                    <Button variant="outline" onClick={copyScript}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar Roteiro
                    </Button>
                  </div>

                  {/* Script */}
                  <div className="space-y-3">
                    <h4 className="font-semibold">Roteiro Sugerido</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">HOOK (0-3s)</p>
                        <p className="text-sm font-medium">{generatedVideo.script.hook}</p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">AÇÃO (3-8s)</p>
                        <p className="text-sm font-medium">{generatedVideo.script.action}</p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">BENEFÍCIO (8-12s)</p>
                        <p className="text-sm font-medium">{generatedVideo.script.benefit}</p>
                      </div>
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">CTA (12-15s)</p>
                        <p className="text-sm font-medium">{generatedVideo.script.cta}</p>
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{generatedVideo.metadata.type}</Badge>
                    <Badge variant="secondary">{generatedVideo.metadata.format}</Badge>
                    <Badge variant="secondary">{generatedVideo.metadata.style}</Badge>
                    <Badge variant="secondary">{generatedVideo.metadata.duration}s</Badge>
                  </div>
                </>
              ) : (
                <div className="aspect-[9/16] max-h-[500px] mx-auto bg-muted/50 rounded-lg flex flex-col items-center justify-center">
                  <Video className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-center">
                    Configure as opções e clique em<br />
                    <span className="font-semibold">"Gerar Vídeo"</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
