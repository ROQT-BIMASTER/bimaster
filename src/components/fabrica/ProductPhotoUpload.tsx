import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProductPhotoUploadProps {
  currentUrl: string | null;
  onUrlChange: (url: string) => void;
  produtoId?: string;
  className?: string;
}

const BUCKET = "fabrica-produto-fotos";

export default function ProductPhotoUpload({
  currentUrl,
  onUrlChange,
  produtoId,
  className,
}: ProductPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const folder = produtoId || "temp";
      const fileName = `${folder}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      const publicUrl = data.publicUrl;

      setPreview(publicUrl);
      onUrlChange(publicUrl);
      toast.success("Foto atualizada!");
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onUrlChange("");
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "relative group rounded-xl border-2 border-dashed border-border/60 bg-muted/30 transition-colors overflow-hidden",
          "hover:border-primary/40 hover:bg-muted/50",
          preview ? "aspect-square max-w-[200px]" : "flex items-center justify-center h-[160px]"
        )}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Foto do produto"
              className="h-full w-full object-cover"
              onError={() => setPreview(null)}
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-3.5 w-3.5 mr-1" />
                Trocar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-4"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <Upload className="h-8 w-8" />
                <span className="text-xs font-medium">Clique para enviar foto</span>
                <span className="text-[10px]">JPG, PNG até 5MB</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
