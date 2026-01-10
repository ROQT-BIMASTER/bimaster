import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, Image, Sparkles, Camera, Box, Film, Download, Copy, Plus, Trash2, RefreshCw } from "lucide-react";
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

interface GeneratedCreative {
  imageUrl: string;
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
  message?: string;
}

const creativeTypes = [
  { id: 'text-to-video', label: 'Text to Video', icon: Video, description: 'Criar vídeo a partir de descrição' },
  { id: 'image-to-video', label: 'Image to Video', icon: Image, description: 'Animar foto de produto' },
  { id: 'ugc-style', label: 'UGC Style', icon: Camera, description: 'Estilo gravado por celular' },
  { id: 'mockup-3d', label: 'Mockup 3D', icon: Box, description: 'Protótipo de embalagem' },
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

export const NanoBananaVideoEngine = () => {
  const [activeType, setActiveType] = useState('text-to-video');
  const [prompt, setPrompt] = useState('');
  const [productName, setProductName] = useState('');
  const [format, setFormat] = useState('9:16');
  const [style, setStyle] = useState('professional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCreative, setGeneratedCreative] = useState<GeneratedCreative | null>(null);
  
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

  const generateCreative = async () => {
    if (!prompt && !uploadedImage) {
      toast.error('Adicione um prompt ou imagem para gerar');
      return;
    }

    setIsGenerating(true);
    try {
      const imageBase64 = uploadedImage?.split(',')[1];

      const { data, error } = await supabase.functions.invoke('nano-banana-video', {
        body: {
          type: activeType,
          prompt,
          productName: productName || undefined,
          brandGuidelines: brandGuidelines.colors.length > 0 || brandGuidelines.style ? brandGuidelines : undefined,
          imageBase64: ['image-to-video', 'ugc-style'].includes(activeType) ? imageBase64 : undefined,
          scenes: activeType === 'multi-scene' ? scenes.filter(s => s.description) : undefined,
          format,
          style,
          duration: 5
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setGeneratedCreative(data);
      toast.success('Criativo gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar:', error);
      toast.error(error.message || 'Erro ao gerar criativo');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedCreative?.imageUrl) return;
    
    const link = document.createElement('a');
    link.href = generatedCreative.imageUrl;
    link.download = `nano-banana-${productName || 'creative'}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Download iniciado!');
  };

  const copyScript = () => {
    if (!generatedCreative?.script?.fullScript) return;
    navigator.clipboard.writeText(generatedCreative.script.fullScript);
    toast.success('Roteiro copiado!');
  };

  const resetAll = () => {
    setPrompt('');
    setProductName('');
    setUploadedImage(null);
    setGeneratedCreative(null);
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
            Gere vídeos e criativos de produto com IA
          </p>
        </div>
        {generatedCreative && (
          <Button variant="outline" onClick={resetAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Novo Criativo
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Painel de Configuração */}
        <div className="space-y-4">
          {/* Tipo de Criativo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Tipo de Criativo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {creativeTypes.map((type) => (
                  <Button
                    key={type.id}
                    variant={activeType === type.id ? "default" : "outline"}
                    className="h-auto py-3 flex flex-col items-center gap-1"
                    onClick={() => setActiveType(type.id)}
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
                />
              </div>
              
              <div>
                <Label htmlFor="prompt">Descrição / Prompt</Label>
                <Textarea
                  id="prompt"
                  placeholder="Descreva o que você quer ver no vídeo..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Formato</Label>
                  <Select value={format} onValueChange={setFormat}>
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
                  <Select value={style} onValueChange={setStyle}>
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
              </div>
            </CardContent>
          </Card>

          {/* Upload de Imagem */}
          {['image-to-video', 'ugc-style'].includes(activeType) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Imagem do Produto</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
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
                      <Button variant="outline" size="sm" onClick={() => setUploadedImage(null)}>
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
                  <Button variant="outline" size="sm" onClick={addScene} disabled={scenes.length >= 5}>
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
                      />
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">Duração</Label>
                      <Select 
                        value={String(scene.duration)} 
                        onValueChange={(v) => updateScene(index, 'duration', Number(v))}
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
                  />
                  <Button variant="outline" size="sm" onClick={addColor}>
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
                        onClick={() => removeColor(color)}
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
                />
              </div>
            </CardContent>
          </Card>

          {/* Botão Gerar */}
          <Button 
            className="w-full" 
            size="lg" 
            onClick={generateCreative}
            disabled={isGenerating || (!prompt && !uploadedImage)}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Gerando criativo...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Gerar Criativo
              </>
            )}
          </Button>
        </div>

        {/* Painel de Preview */}
        <div className="space-y-4">
          <Card className="min-h-[400px]">
            <CardHeader>
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>
                {generatedCreative ? 'Criativo gerado com sucesso!' : 'Configure e gere seu criativo'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">Gerando seu criativo...</p>
                </div>
              ) : generatedCreative ? (
                <div className="space-y-4">
                  <div className={`relative rounded-lg overflow-hidden bg-muted ${
                    format === '9:16' ? 'aspect-[9/16] max-h-[400px] mx-auto' :
                    format === '16:9' ? 'aspect-video' : 'aspect-square max-w-[300px] mx-auto'
                  }`}>
                    <img
                      src={generatedCreative.imageUrl}
                      alt="Generated creative"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={downloadImage}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={copyScript}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar Roteiro
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Video className="h-16 w-16 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Preencha o briefing e clique em "Gerar Criativo"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Roteiro Gerado */}
          {generatedCreative?.script && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🎬 Roteiro de Vídeo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <p className="text-xs font-medium text-primary mb-1">HOOK (0-3s)</p>
                    <p className="text-sm">{generatedCreative.script.hook}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <p className="text-xs font-medium text-blue-600 mb-1">AÇÃO (3-8s)</p>
                    <p className="text-sm">{generatedCreative.script.action}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10">
                    <p className="text-xs font-medium text-green-600 mb-1">BENEFÍCIO (8-12s)</p>
                    <p className="text-sm">{generatedCreative.script.benefit}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-orange-500/10">
                    <p className="text-xs font-medium text-orange-600 mb-1">CTA (12-15s)</p>
                    <p className="text-sm">{generatedCreative.script.cta}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadados */}
          {generatedCreative?.metadata && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Metadados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{generatedCreative.metadata.type}</Badge>
                  <Badge variant="outline">{generatedCreative.metadata.format}</Badge>
                  <Badge variant="outline">{generatedCreative.metadata.style}</Badge>
                  {generatedCreative.metadata.productName && (
                    <Badge>{generatedCreative.metadata.productName}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default NanoBananaVideoEngine;
