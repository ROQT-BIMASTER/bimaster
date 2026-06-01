import { useEffect, useState } from "react";
import { signedAnexoUrl, formatBytes } from "./utils";
import { FileText, Download, Loader2, X, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ChatAnexo } from "@/hooks/chat/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArquivarAnexoChatDialog } from "./ArquivarAnexoChatDialog";


export function AnexoView({ anexo, mine }: { anexo: ChatAnexo; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [arquivarOpen, setArquivarOpen] = useState(false);
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
      <>
        <div className="rounded-lg overflow-hidden max-w-xs relative group">
          {url ? (
            <>
              <img
                src={url}
                alt={anexo.file_name}
                className="block w-full h-auto cursor-pointer"
                onClick={() => setLightboxOpen(true)}
                title="Clique para ampliar"
              />
              {/* Botão de download visível em hover (desktop) e sempre em mobile */}
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-2 right-2 h-8 w-8 shadow-md md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); baixar(); }}
                title="Baixar imagem"
                aria-label="Baixar imagem"
              >
                <Download className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="h-40 w-60 bg-muted flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
          )}
        </div>

        {/* Lightbox em tela cheia ao clicar na imagem */}
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent
            className="max-w-screen-lg w-fit p-0 bg-transparent border-0 shadow-none [&>button]:hidden"
            onClick={() => setLightboxOpen(false)}
          >
            {url && (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <img
                  src={url}
                  alt={anexo.file_name}
                  className="max-h-[88vh] w-auto rounded-lg"
                />
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shadow-md"
                    onClick={baixar}
                  >
                    <Download className="h-4 w-4 mr-2" /> Baixar
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-9 w-9 shadow-md"
                    onClick={() => setLightboxOpen(false)}
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="absolute bottom-3 left-3 text-xs text-white bg-black/50 rounded px-2 py-1 backdrop-blur">
                  {anexo.file_name} · {formatBytes(anexo.size_bytes)}
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }
  if (isVideo) {
    return url ? (
      <div className="relative group max-w-xs">
        <video src={url} controls className="rounded-lg w-full" />
        <Button
          size="icon"
          variant="secondary"
          className="absolute top-2 right-2 h-8 w-8 shadow-md md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          onClick={baixar}
          title="Baixar vídeo"
          aria-label="Baixar vídeo"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    ) : <div className="h-40 w-60 bg-muted rounded-lg" />;
  }
  if (isAudio) {
    return url ? (
      <div className="flex items-center gap-2 max-w-xs">
        <audio src={url} controls className="flex-1 min-w-0" />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={baixar}
          title="Baixar áudio"
          aria-label="Baixar áudio"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    ) : <div className="h-10 w-60 bg-muted rounded-lg" />;
  }
  return (
    <div className={cn("flex items-center gap-2 rounded-lg p-2 max-w-xs", mine ? "bg-primary/10" : "bg-muted")}>
      <FileText className="h-8 w-8 shrink-0 opacity-70" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{anexo.file_name}</p>
        <p className="text-[10px] text-muted-foreground">{formatBytes(anexo.size_bytes)}</p>
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={baixar} title="Baixar" aria-label="Baixar">
        <Download className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
