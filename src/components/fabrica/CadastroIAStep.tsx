import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, ImageIcon, FileText, ArrowLeft, Sparkles, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CadastroIAStepProps {
  onBack: () => void;
  onDataExtracted: (data: Record<string, any>, method: "text" | "image") => void;
}

export function CadastroIAStep({ onBack, onDataExtracted }: CadastroIAStepProps) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [termoAceito, setTermoAceito] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Envie apenas imagens (PNG, JPG, WEBP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande (máximo 10MB)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);
      // Extract base64 without the data:image/... prefix
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAnalyze = async () => {
    if (!text.trim() && !imageBase64) {
      toast.error("Cole um texto ou envie uma imagem para análise");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("extrair-produto-ia", {
        body: {
          text: text.trim() || undefined,
          imageBase64: imageBase64 || undefined,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const extracted = data?.data;
      if (!extracted) {
        toast.error("Nenhum dado foi extraído. Tente com um texto mais detalhado.");
        return;
      }

      // Count how many fields were extracted
      const filledFields = Object.entries(extracted).filter(
        ([, v]) => v !== null && v !== undefined && v !== ""
      ).length;

      toast.success(`${filledFields} campos extraídos com sucesso!`);
      onDataExtracted(extracted, imageBase64 ? "image" : "text");
    } catch (err: any) {
      console.error("Erro ao extrair dados:", err);
      toast.error(err.message || "Erro ao analisar dados com IA");
    } finally {
      setLoading(false);
    }
  };

  const hasInput = text.trim().length > 0 || !!imageBase64;
  const canAnalyze = hasInput && termoAceito && !loading;

  return (
    <div className="space-y-5">
      {/* Back button */}
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-2 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Button>

      {/* Input section */}
      <div className="space-y-4">
        <div>
          <Label className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-primary" />
            Cole o texto do ERP
          </Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole aqui os dados do produto copiados do ERP antigo..."
            rows={6}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground font-medium">OU</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div>
          <Label className="flex items-center gap-2 mb-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            Envie um print do ERP
          </Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {imagePreview ? (
            <div className="relative border rounded-lg p-2 bg-muted/30">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-48 mx-auto rounded object-contain"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={removeImage}
              >
                Remover
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full h-24 border-dashed gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-5 w-5" />
              Clique para enviar imagem
            </Button>
          )}
        </div>
      </div>

      {/* Termo de responsabilidade */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Termo de Responsabilidade
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
              Declaro estar ciente de que os dados extraídos por Inteligência Artificial
              são sugestões automáticas e podem conter erros ou imprecisões. Assumo total
              responsabilidade pela revisão, validação e correção de todos os campos antes
              de salvar o cadastro do produto.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-7">
          <Checkbox
            id="termo-ia"
            checked={termoAceito}
            onCheckedChange={(checked) => setTermoAceito(checked === true)}
          />
          <Label htmlFor="termo-ia" className="text-xs font-medium cursor-pointer">
            Li e concordo com os termos acima
          </Label>
        </div>
      </div>

      {/* Analyze button */}
      <Button
        type="button"
        className="w-full gap-2"
        variant="gradient"
        disabled={!canAnalyze}
        onClick={handleAnalyze}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando com IA...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Analisar com IA
          </>
        )}
      </Button>
    </div>
  );
}
