import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { buildFabricaPhotoPath, FABRICA_FOTOS_BUCKET } from "@/lib/fabrica/photoPath";
import { guardFileUpload, reportUploadSuccessShared, reportUploadFailureShared } from "@/lib/utils/sharedUploadGuard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function describeUploadError(err: any): { title: string; message: string; hint?: string } {
  const raw = (err?.message || err?.error || String(err || "")).toString();
  const status = err?.statusCode || err?.status;
  const lower = raw.toLowerCase();

  if (lower.includes("row-level security") || lower.includes("rls") || status === 403 || lower.includes("unauthorized") || lower.includes("not authorized")) {
    return {
      title: "Sem permissão para enviar foto",
      message: "Seu usuário não tem permissão para subir fotos no módulo Fábrica.",
      hint: "Solicite ao administrador acesso de upload no bucket de fotos de produtos acabados.",
    };
  }
  if (lower.includes("jwt") || lower.includes("expired") || status === 401) {
    return {
      title: "Sessão expirada",
      message: "Sua sessão expirou. Faça login novamente para enviar a foto.",
    };
  }
  if (lower.includes("payload") || lower.includes("too large") || status === 413) {
    return {
      title: "Arquivo muito grande",
      message: "A imagem excede o tamanho permitido (máximo 5MB).",
    };
  }
  if (lower.includes("mime") || lower.includes("invalid") && lower.includes("type")) {
    return {
      title: "Formato inválido",
      message: "O arquivo enviado não é uma imagem válida. Use JPG, PNG ou WebP.",
    };
  }
  if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("timeout")) {
    return {
      title: "Falha de conexão",
      message: "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.",
    };
  }
  if (lower.includes("bucket") && lower.includes("not found")) {
    return {
      title: "Configuração indisponível",
      message: "O repositório de fotos não foi encontrado. Avise o administrador.",
    };
  }
  return {
    title: "Erro ao enviar foto",
    message: raw || "Ocorreu um erro inesperado ao processar o upload.",
    hint: status ? `Código: ${status}` : undefined,
  };
}

interface ProductPhotoUploadProps {
  currentUrl: string | null;
  onUrlChange: (url: string) => void;
  produtoId?: string;
  className?: string;
}

const BUCKET = FABRICA_FOTOS_BUCKET;

/** Resolve a storage path or old public URL into a signed URL */
async function resolvePhotoUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  // If it's already a signed URL or external URL, use as-is
  if (url.includes("token=")) return url;
  // Extract the path from a public URL pattern
  const bucketPath = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(bucketPath);
  const filePath = idx >= 0 ? url.substring(idx + bucketPath.length) : null;
  if (!filePath) return url; // external URL, return as-is
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 31536000); // 1 year
  return data?.signedUrl || null;
}

export default function ProductPhotoUpload({
  currentUrl,
  onUrlChange,
  produtoId,
  className,
}: ProductPhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string; hint?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resolve the initial URL to a signed URL
  useEffect(() => {
    resolvePhotoUrl(currentUrl).then(setPreview);
  }, [currentUrl]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }
    // Guard compartilhado (magic bytes / double-extension / MIME real).
    const guardOk = await guardFileUpload({ file, module: "fabrica-produto-foto", contextId: produtoId });
    if (!guardOk) return;

    setUploading(true);
    try {
      const fileName = buildFabricaPhotoPath({ produtoId, fileName: file.name });

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        reportUploadFailureShared({ module: "fabrica-produto-foto", file, contextId: produtoId, error: uploadError });
        throw uploadError;
      }
      reportUploadSuccessShared({ module: "fabrica-produto-foto", file, contextId: produtoId, storagePath: fileName });

      // Use signed URL instead of public URL
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(fileName, 31536000); // 1 year
      const signedUrl = data?.signedUrl || "";

      setPreview(signedUrl);
      onUrlChange(signedUrl);
      toast.success("Foto atualizada!");
    } catch (err: any) {
      logger.error("Upload error:", err);
      const info = describeUploadError(err);
      setErrorDialog(info);
      toast.error(info.title, { description: info.message });
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

      <AlertDialog open={!!errorDialog} onOpenChange={(open) => !open && setErrorDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{errorDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">{errorDialog?.message}</span>
              {errorDialog?.hint && (
                <span className="block text-xs text-muted-foreground">{errorDialog.hint}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDialog(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
