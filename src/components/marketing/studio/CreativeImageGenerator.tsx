import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Sparkles, Upload, X, Download, Paintbrush, Package, Share2,
  Image as ImageIcon, Zap, Crown
} from "lucide-react";

const FORMAT_OPTIONS = [
  { value: "1:1", label: "Post Instagram (1:1)", icon: "📱" },
  { value: "9:16", label: "Story / Reels (9:16)", icon: "📲" },
  { value: "16:9", label: "Banner / Cover (16:9)", icon: "🖥️" },
  { value: "4:5", label: "Instagram Retrato (4:5)", icon: "📸" },
  { value: "3:4", label: "Produto (3:4)", icon: "🛍️" },
];

const CATEGORY_OPTIONS = [
  { value: "marketing", label: "Marketing de Produtos", icon: Paintbrush },
  { value: "mockup", label: "Mockup de Embalagem", icon: Package },
  { value: "social_media", label: "Redes Sociais", icon: Share2 },
];

const QUICK_PROMPTS = [
  { label: "Mockup Cosmético", prompt: "Crie um mockup fotorrealista de um frasco de creme facial premium em fundo de mármore branco, iluminação suave de estúdio, estilo editorial de beleza" },
  { label: "Post Promocional", prompt: "Crie uma arte promocional moderna e vibrante para lançamento de produto de beleza, com cores quentes e tipografia elegante" },
  { label: "Flat Lay Produtos", prompt: "Flat lay elegante com produtos de beleza dispostos artisticamente em fundo pastel, flores secas como decoração, estilo Pinterest" },
  { label: "Antes e Depois", prompt: "Arte clean de antes e depois para skincare, com divisória geométrica moderna, fundo neutro, estilo clínico e profissional" },
  { label: "Story Engajamento", prompt: "Story interativo de Instagram para marca de beleza com enquete, cores gradientes vibrantes, tipografia bold e moderna" },
  { label: "Embalagem 3D", prompt: "Renderização 3D fotorrealista de embalagem de perfume luxuoso com reflexos dourados, fundo escuro dramático, iluminação cinematográfica" },
];

interface CreativeImageGeneratorProps {
  onImageGenerated?: () => void;
}

export const CreativeImageGenerator = ({ onImageGenerated }: CreativeImageGeneratorProps) => {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<"flash" | "pro">("flash");
  const [format, setFormat] = useState("1:1");
  const [category, setCategory] = useState("marketing");
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setReferencePreview(result);
      setReferenceImage(result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setReferenceImage(null);
    setReferencePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Digite um prompt para gerar a imagem");
      return;
    }
    setLoading(true);
    setGeneratedImage(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-creative-studio", {
        body: {
          prompt: prompt.trim(),
          imageBase64: referenceImage || undefined,
          model,
          format,
          category,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setGeneratedImage(data.imageUrl);
      toast.success("Imagem gerada com sucesso!");
      onImageGenerated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar imagem";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;
    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `creative-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado!");
    } catch {
      toast.error("Erro ao fazer download");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Estúdio Criativo com IA
          </CardTitle>
          <CardDescription>
            Gere imagens profissionais para marketing, mockups e redes sociais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick prompts */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Sugestões rápidas</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((qp) => (
                <Badge
                  key={qp.label}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
                  onClick={() => setPrompt(qp.prompt)}
                >
                  {qp.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <span className="flex items-center gap-2">
                        <c.icon className="h-3 w-3" /> {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Formato</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.icon} {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modelo IA</Label>
              <Select value={model} onValueChange={(v) => setModel(v as "flash" | "pro")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flash">
                    <span className="flex items-center gap-2"><Zap className="h-3 w-3" /> Flash (rápido)</span>
                  </SelectItem>
                  <SelectItem value="pro">
                    <span className="flex items-center gap-2"><Crown className="h-3 w-3" /> Pro (alta qualidade)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label>Imagem de Referência / Edição (opcional)</Label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <Upload className="h-3 w-3 mr-1" /> Upload Imagem
              </Button>
              {referencePreview && (
                <div className="relative">
                  <img src={referencePreview} alt="Referência" className="h-16 w-16 object-cover rounded border" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full bg-destructive text-destructive-foreground"
                    onClick={removeImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Envie uma imagem para editar com IA (trocar fundo, cenário, etc.) ou como referência visual.
            </p>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <Label>Descreva a imagem que deseja criar</Label>
            <Textarea
              placeholder="Ex: Crie um mockup fotorrealista de um batom vermelho premium em fundo marble com iluminação cinematográfica..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
          </div>

          <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="w-full">
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando imagem...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Gerar Imagem</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated result */}
      {generatedImage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4" /> Resultado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
              <img
                src={generatedImage}
                alt="Imagem gerada"
                className="max-w-full max-h-[500px] object-contain"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleDownload}>
                <Download className="h-3 w-3 mr-1" /> Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setReferenceImage(generatedImage);
                  setReferencePreview(generatedImage);
                  toast.info("Imagem carregada como referência. Edite o prompt e gere novamente!");
                }}
              >
                <Paintbrush className="h-3 w-3 mr-1" /> Editar com IA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
