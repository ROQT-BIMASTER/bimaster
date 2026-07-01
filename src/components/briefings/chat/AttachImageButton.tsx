import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { guardFileUpload, reportUploadSuccessShared, reportUploadFailureShared } from "@/lib/utils/sharedUploadGuard";

export interface ChatAttachment {
  path: string;
  mime: "image/png" | "image/jpeg" | "image/webp";
  name: string;
  previewUrl: string;
}

interface Props {
  briefingId: string;
  attachments: ChatAttachment[];
  setAttachments: (a: ChatAttachment[]) => void;
  disabled?: boolean;
}

const ALLOWED = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 4;

export function AttachImageButton({ briefingId, attachments, setAttachments, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (attachments.length + files.length > MAX_FILES) {
      toast.error(`Máximo de ${MAX_FILES} imagens por mensagem`);
      return;
    }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const novos: ChatAttachment[] = [];
      for (const f of Array.from(files)) {
        if (!ALLOWED.includes(f.type as any)) {
          toast.error(`Tipo não suportado: ${f.name}`);
          continue;
        }
        if (f.size > MAX_BYTES) {
          toast.error(`Arquivo acima de 10MB: ${f.name}`);
          continue;
        }
        // Guard compartilhado (magic bytes / double-extension / MIME real).
        const ok = await guardFileUpload({ file: f, module: "chat-briefing", userId: uid, contextId: briefingId });
        if (!ok) continue;
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const path = `${briefingId}/${uid}/${crypto.randomUUID()}/${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("briefing-chat-anexos")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) {
          reportUploadFailureShared({ module: "chat-briefing", file: f, userId: uid, contextId: briefingId, error: upErr, toast: true });
          continue;
        }
        reportUploadSuccessShared({ module: "chat-briefing", file: f, userId: uid, contextId: briefingId, storagePath: path });
        const { data: signed } = await supabase.storage
          .from("briefing-chat-anexos")
          .createSignedUrl(path, 600);
        novos.push({
          path,
          mime: f.type as any,
          name: f.name,
          previewUrl: signed?.signedUrl ?? "",
        });
      }
      if (novos.length > 0) setAttachments([...attachments, ...novos]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remover = async (att: ChatAttachment) => {
    await supabase.storage.from("briefing-chat-anexos").remove([att.path]);
    setAttachments(attachments.filter((a) => a.path !== att.path));
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        title="Anexar imagem para a IA analisar"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
      </Button>
      {attachments.length > 0 && (
        <div className="absolute -top-14 left-2 flex gap-1.5">
          {attachments.map((a) => (
            <div key={a.path} className="relative h-12 w-12 rounded-md overflow-hidden border bg-muted">
              {a.previewUrl ? (
                <img src={a.previewUrl} alt={a.name} className="h-full w-full object-cover" />
              ) : null}
              <button
                type="button"
                onClick={() => remover(a)}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-background border flex items-center justify-center"
                title="Remover"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
