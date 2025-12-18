import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, Wand2, Loader2, Download, Copy, RefreshCw, 
  Image, X, Sparkles, Instagram, Layout, FileImage
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CreativeTemplate {
  id: string;
  label: string;
  prompt: string;
  icon: React.ReactNode;
}

const creativeTemplates: CreativeTemplate[] = [
  {
    id: "instagram-post",
    label: "Post Instagram",
    prompt: "Crie um post profissional para Instagram (1080x1080) com este produto. Adicione um fundo gradiente elegante, iluminação de estúdio e um visual moderno e clean. Mantenha o produto como foco principal.",
    icon: <Instagram className="h-4 w-4" />
  },
  {
    id: "banner-promo",
    label: "Banner Promocional",
    prompt: "Transforme em um banner promocional (1200x628) com espaço para texto de desconto. Use cores vibrantes e destaque o produto com efeitos de brilho e sombra profissional.",
    icon: <Layout className="h-4 w-4" />
  },
  {
    id: "story",
    label: "Story/Reels",
    prompt: "Crie uma imagem vertical para Story/Reels (1080x1920) com este produto. Adicione elementos dinâmicos, gradientes modernos e um visual que chame atenção nas redes sociais.",
    icon: <FileImage className="h-4 w-4" />
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    prompt: "Coloque este produto em um cenário lifestyle sofisticado. Adicione elementos decorativos, plantas, texturas de madeira ou mármore para criar uma composição elegante e aspiracional.",
    icon: <Sparkles className="h-4 w-4" />
  },
  {
    id: "minimalist",
    label: "Minimalista",
    prompt: "Crie uma versão minimalista com fundo branco puro, sombra suave e iluminação profissional de estúdio. O produto deve ser o único elemento, com muito espaço negativo.",
    icon: <Image className="h-4 w-4" />
  }
];

export function ProductCreativeGenerator() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      convertToBase64(file);
    } else {
      toast.error("Por favor, envie apenas imagens");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      convertToBase64(file);
    }
  };

  const convertToBase64 = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setGeneratedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const selectTemplate = (template: CreativeTemplate) => {
    setSelectedTemplate(template.id);
    setPrompt(template.prompt);
  };

  const generateCreative = async () => {
    if (!uploadedImage) {
      toast.error("Faça upload de uma imagem do produto primeiro");
      return;
    }

    if (!prompt.trim()) {
      toast.error("Digite ou selecione um prompt para o criativo");
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-creative', {
        body: { 
          prompt,
          imageBase64: uploadedImage
        }
      });

      if (error) throw error;
      
      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success("Criativo gerado com sucesso!");
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error generating creative:', error);
      toast.error(error.message || "Erro ao gerar criativo. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `criativo-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download iniciado!");
  };

  const copyToClipboard = async () => {
    if (!generatedImage) return;
    
    try {
      await navigator.clipboard.writeText(generatedImage);
      toast.success("URL copiada para a área de transferência!");
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const resetAll = () => {
    setUploadedImage(null);
    setGeneratedImage(null);
    setPrompt("");
    setSelectedTemplate(null);
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">1. Upload da foto do produto</Label>
        
        {!uploadedImage ? (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
              "hover:border-primary/50"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('product-image-upload')?.click()}
          >
            <input
              id="product-image-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Arraste a foto do produto ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG ou WEBP</p>
          </div>
        ) : (
          <div className="relative rounded-lg overflow-hidden border bg-muted/20">
            <img 
              src={uploadedImage} 
              alt="Produto" 
              className="w-full max-h-64 object-contain"
            />
            <Button
              size="sm"
              variant="destructive"
              className="absolute top-2 right-2"
              onClick={() => {
                setUploadedImage(null);
                setGeneratedImage(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Template Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">2. Escolha um estilo de criativo</Label>
        <div className="flex flex-wrap gap-2">
          {creativeTemplates.map((template) => (
            <Badge
              key={template.id}
              variant={selectedTemplate === template.id ? "default" : "secondary"}
              className={cn(
                "cursor-pointer py-2 px-3 transition-all",
                selectedTemplate === template.id 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-primary/10"
              )}
              onClick={() => selectTemplate(template)}
            >
              {template.icon}
              <span className="ml-1.5">{template.label}</span>
            </Badge>
          ))}
        </div>
      </div>

      {/* Custom Prompt */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">3. Personalize o prompt (opcional)</Label>
        <Textarea
          placeholder="Descreva como deseja o criativo ou edite o prompt do template selecionado..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Generate Button */}
      <div className="flex gap-2">
        <Button 
          onClick={generateCreative} 
          disabled={generating || !uploadedImage} 
          className="flex-1"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando criativo...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Gerar Criativo com IA
            </>
          )}
        </Button>
        <Button variant="outline" onClick={resetAll} title="Limpar tudo">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Generated Result */}
      {generatedImage && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-green-600 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Criativo gerado!
          </Label>
          <div className="relative rounded-lg overflow-hidden border">
            <img 
              src={generatedImage} 
              alt="Criativo gerado" 
              className="w-full"
            />
            <div className="absolute bottom-2 right-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={downloadImage}>
                <Download className="h-4 w-4 mr-1" />
                Baixar
              </Button>
              <Button size="sm" variant="secondary" onClick={copyToClipboard}>
                <Copy className="h-4 w-4 mr-1" />
                Copiar URL
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
