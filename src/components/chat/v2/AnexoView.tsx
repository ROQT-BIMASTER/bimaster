import { useEffect, useState } from "react";
import { signedAnexoUrl, formatBytes } from "./utils";
import { FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatAnexo } from "@/hooks/chat/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AnexoView({ anexo, mine }: { anexo: ChatAnexo; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = anexo.mime_type?.startsWith("image/");
  const isVideo = anexo.mime_type?.startsWith("video/");
  const isAudio = anexo.mime_type?.startsWith("audio/");

  useEffect(() => {
    let alive = true;
    signedAnexoUrl(anexo.storage_path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [anexo.storage_path]);

  const baixar = async () => {
    try {
      const { data, error } = await supabase.storage.from("chat-anexos").download(anexo.storage_path);
      if (error || !data) throw error ?? new Error("falha");
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = blobUrl; a.download = anexo.file_name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      toast.error("Erro ao baixar: " + (e?.message ?? ""));
    }
  };

  if (isImage) {
    return (
      <div className="rounded-lg overflow-hidden max-w-xs">
        {url ? (
          <img src={url} alt={anexo.file_name} className="block w-full h-auto cursor-pointer" onClick={baixar} />
        ) : (
          <div className="h-40 w-60 bg-muted flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
        )}
      </div>
    );
  }
  if (isVideo) {
    return url ? <video src={url} controls className="rounded-lg max-w-xs" /> : <div className="h-40 w-60 bg-muted rounded-lg" />;
  }
  if (isAudio) {
    return url ? <audio src={url} controls className="max-w-xs" /> : <div className="h-10 w-60 bg-muted rounded-lg" />;
  }
  return (
    <div className={cn("flex items-center gap-2 rounded-lg p-2 max-w-xs", mine ? "bg-primary/10" : "bg-muted")}>
      <FileText className="h-8 w-8 shrink-0 opacity-70" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{anexo.file_name}</p>
        <p className="text-[10px] text-muted-foreground">{formatBytes(anexo.size_bytes)}</p>
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={baixar}><Download className="h-3.5 w-3.5" /></Button>
    </div>
  );
}
