import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, Upload, X, Wand2, ImagePlus } from "lucide-react";

interface Props {
  onImageGenerated: (base64: string) => void;
  disabled?: boolean;
}

export function AiBannerGenerator({ onImageGenerated, disabled }: Props) {
  const [prompt, setPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileToBase64(file);
    setReferenceImage(base64);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Digite um prompt descrevendo o banner desejado");
      return;
    }

    setGenerating(true);
    setPreview(null);

    try {
      toast.info("🤖 Gerando imagem com IA...");

      const body: any = { prompt: prompt.trim() };
      if (referenceImage) {
        body.imageBase64 = referenceImage;
      }

      const { data, error } = await supabase.functions.invoke("generate-banner-image", { body });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("Limite") || data.error.includes("Rate")) {
          toast.error("Limite de requisições excedido. Tente novamente em segundos.");
        } else if (data.error.includes("Créditos") || data.error.includes("Credits")) {
          toast.error("Créditos de IA esgotados.");
        } else {
          throw new Error(data.error);
        }
        return;
      }

      if (!data?.generatedImage) throw new Error("Nenhuma imagem retornada");

      setPreview(data.generatedImage);
      toast.success("🎨 Imagem gerada! Confira o resultado.");
    } catch (err) {
      console.error("AI generation failed:", err);
      toast.error("Falha ao gerar imagem com IA");
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = () => {
    if (preview) {
      onImageGenerated(preview);
      setPreview(null);
      setPrompt("");
      setReferenceImage(null);
      toast.success("Imagem aplicada!");
    }
  };

  const handleReject = () => {
    setPreview(null);
  };

  return (
    <div className="space-y-3 p-3 border border-dashed border-primary/30 rounded-xl bg-primary/5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold text-primary">Criar Banner com IA</Label>
      </div>

      {/* Prompt input */}
      <div className="flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex: Banner promocional de trade marketing com cores vibrantes..."
          disabled={generating || disabled}
          className="flex-1 text-sm"
          onKeyDown={(e) => e.key === "Enter" && !generating && handleGenerate()}
        />
        <Button
          type="button"
          size="sm"
          onClick={handleGenerate}
          disabled={generating || disabled || !prompt.trim()}
          className="gap-1.5 bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(330,81%,60%)] text-white shrink-0"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          Gerar
        </Button>
      </div>

      {/* Reference image upload */}
      <div className="flex items-center gap-2">
        {referenceImage ? (
          <div className="relative flex items-center gap-2">
            <img src={referenceImage} alt="Ref" className="h-10 w-14 object-cover rounded-lg border" />
            <span className="text-xs text-muted-foreground">Imagem de referência</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setReferenceImage(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            <ImagePlus className="h-3.5 w-3.5" />
            <span>Subir imagem de referência (opcional)</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleReferenceUpload} disabled={generating || disabled} />
          </label>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="space-y-2">
          <img src={preview} alt="Preview IA" className="w-full h-32 object-cover rounded-xl border shadow-sm" />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleAccept} className="flex-1 gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Usar esta imagem
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleReject} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              Descartar
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={handleGenerate} disabled={generating} className="gap-1.5">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Regenerar
            </Button>
          </div>
        </div>
      )}

      {generating && !preview && (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Gerando banner com IA... pode levar alguns segundos</span>
        </div>
      )}
    </div>
  );
}
