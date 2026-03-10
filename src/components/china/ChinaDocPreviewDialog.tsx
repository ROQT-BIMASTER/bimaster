import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, Loader2, FileText } from "lucide-react";
import { getSignedUrl } from "@/lib/utils/storage-helper";

interface ChinaDocPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  arquivoPath?: string | null;
  arquivoUrl?: string | null;
  nomeArquivo?: string | null;
  tipoDocumento?: string;
}

function isImage(name: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
}

function isPdf(name: string) {
  return /\.pdf$/i.test(name);
}

export function ChinaDocPreviewDialog({
  open,
  onOpenChange,
  arquivoPath,
  arquivoUrl,
  nomeArquivo,
  tipoDocumento,
}: ChinaDocPreviewDialogProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setResolvedUrl(null);
      return;
    }

    async function resolve() {
      setLoading(true);
      if (arquivoPath) {
        const { signedUrl } = await getSignedUrl("china-documentos", arquivoPath);
        setResolvedUrl(signedUrl || null);
      } else if (arquivoUrl) {
        setResolvedUrl(arquivoUrl);
      }
      setLoading(false);
    }
    resolve();
  }, [open, arquivoPath, arquivoUrl]);

  const fileName = nomeArquivo || arquivoPath?.split("/").pop() || "documento";
  const showImage = isImage(fileName);
  const showPdf = isPdf(fileName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium truncate">
            {tipoDocumento && (
              <span className="text-muted-foreground mr-2">[{tipoDocumento}]</span>
            )}
            {fileName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !resolvedUrl ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Não foi possível carregar o arquivo</p>
            </div>
          ) : showImage ? (
            <img
              src={resolvedUrl}
              alt={fileName}
              className="w-full h-auto rounded-md object-contain max-h-[60vh]"
            />
          ) : showPdf ? (
            <iframe
              src={resolvedUrl}
              className="w-full h-[60vh] rounded-md border"
              title={fileName}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Preview não disponível para este tipo de arquivo</p>
            </div>
          )}
        </div>

        {resolvedUrl && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" asChild>
              <a href={resolvedUrl} download={fileName}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Abrir
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
