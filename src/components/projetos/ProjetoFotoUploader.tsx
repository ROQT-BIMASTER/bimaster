import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PROJETO_CAPAS_BUCKET } from "@/hooks/useProjetoCapaUrl";
import { validateProjetoFoto } from "@/lib/projetos/projetoFoto";
import { ProjetoAvatar } from "./ProjetoAvatar";

interface Props {
  projetoId: string;
  nome: string;
  cor?: string | null;
  imagemUrl: string | null;
  onChange: (path: string | null) => void;
  disabled?: boolean;
}

export function ProjetoFotoUploader({
  projetoId,
  nome,
  cor,
  imagemUrl,
  onChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    const check = await validateProjetoFoto(file);
    if (!check.valid) {
      toast.error(check.error || "Arquivo inválido.");
      return;
    }
    setUploading(true);
    try {
      const path = `${projetoId}/capa-${Date.now()}.${check.ext}`;
      const { error } = await supabase.storage
        .from(PROJETO_CAPAS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error) throw error;

      // Remove a foto anterior (best-effort)
      if (imagemUrl && !/^https?:\/\//i.test(imagemUrl)) {
        await supabase.storage.from(PROJETO_CAPAS_BUCKET).remove([imagemUrl]);
      }

      onChange(path);
      toast.success("Foto carregada. Salve para aplicar.");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <ProjetoAvatar
        nome={nome}
        cor={cor}
        imagemUrl={imagemUrl}
        className="h-16 w-16 rounded-xl shadow-sm"
        textClassName="text-xl"
      />
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4 mr-2" />
            )}
            {imagemUrl ? "Trocar foto" : "Enviar foto"}
          </Button>
          {imagemUrl && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled || uploading}
              onClick={() => onChange(null)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          JPG, PNG ou WEBP · até 5 MB. Sem foto, usamos a cor do projeto.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
