/**
 * ChatAttachmentChip — exibe um anexo do chat (imagem inline ou
 * card de PDF). Download via blob (StoragePreviewDialog/triggerBlobDownload).
 */
import { useEffect, useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { downloadStorageBlob, triggerBlobDownload } from "@/lib/utils/storage-download";
import { toast } from "sonner";

export interface ChatAnexo {
  path: string;
  nome: string;
  mime: string;
  size: number;
}

interface Props {
  anexo: ChatAnexo;
  isLightBg?: boolean;
}

export function ChatAttachmentChip({ anexo, isLightBg }: Props) {
  const isImage = anexo.mime.startsWith("image/");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isImage) return;
    let alive = true;
    let revoke: string | null = null;
    (async () => {
      const { data } = await supabase.storage.from("china-chat-anexos").createSignedUrl(anexo.path, 60 * 30);
      if (alive && data?.signedUrl) {
        setImgUrl(data.signedUrl);
        revoke = data.signedUrl;
      }
    })();
    return () => { alive = false; if (revoke) { /* signed URL, nada a revogar */ } };
  }, [anexo.path, isImage]);

  const baixar = async () => {
    setDownloading(true);
    try {
      const r = await downloadStorageBlob(anexo.path, "china-chat-anexos");
      if (!r) throw new Error("Falha ao baixar arquivo");
      triggerBlobDownload(r.blobUrl, anexo.nome);
    } catch (err: any) {
      toast.error(err.message || "Falha ao baixar arquivo");
    } finally {
      setDownloading(false);
    }
  };

  if (isImage) {
    return (
      <div className="mt-1 rounded-lg overflow-hidden border max-w-[260px]">
        {imgUrl ? (
          <a href={imgUrl} target="_blank" rel="noopener noreferrer">
            <img src={imgUrl} alt={anexo.nome} className="w-full h-auto block" loading="lazy" />
          </a>
        ) : (
          <div className="aspect-video bg-muted flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className={`px-2 py-1 text-[10px] flex items-center justify-between ${
          isLightBg ? "bg-muted text-muted-foreground" : "bg-black/20 text-white/90"
        }`}>
          <span className="truncate">{anexo.nome}</span>
          <button onClick={baixar} disabled={downloading} className="hover:underline shrink-0 ml-2">
            {downloading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />}
          </button>
        </div>
      </div>
    );
  }

  // PDF / outros
  return (
    <div className={`mt-1 flex items-center gap-2 rounded-lg border px-2 py-1.5 max-w-[280px] ${
      isLightBg ? "bg-muted/50" : "bg-black/20 border-white/20"
    }`}>
      <FileText className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{anexo.nome}</p>
        <p className="text-[10px] opacity-70">{(anexo.size / 1024).toFixed(0)} KB</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={baixar}
        disabled={downloading}
        title="Baixar"
      >
        {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      </Button>
    </div>
  );
}
