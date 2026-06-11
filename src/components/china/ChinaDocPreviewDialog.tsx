import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Download, Loader2, FileText, AlertTriangle, RefreshCw } from "lucide-react";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { downloadStorageBlob, triggerBlobDownload } from "@/lib/utils/storage-download";
import { useChinaI18n } from "@/hooks/useChinaI18n";
import { toast } from "sonner";

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

type PreviewStatus = "idle" | "loading" | "ready" | "error";

export function ChinaDocPreviewDialog({
  open,
  onOpenChange,
  arquivoPath,
  arquivoUrl,
  nomeArquivo,
  tipoDocumento,
}: ChinaDocPreviewDialogProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const { t } = useChinaI18n();

  const fileName = nomeArquivo || arquivoPath?.split("/").pop() || "documento";
  const showImage = isImage(fileName);
  const showPdf = isPdf(fileName);

  const resolve = useCallback(async () => {
    setStatus("loading");
    setErrorMsg(null);
    setResolvedUrl(null);
    try {
      if (arquivoPath) {
        const { signedUrl, error } = await getSignedUrl("china-documentos", arquivoPath, 3600);
        if (error || !signedUrl) {
          setStatus("error");
          setErrorMsg(error?.message ?? t("documento.preview.naoCarregou"));
          return;
        }
        setResolvedUrl(signedUrl);
        setStatus("ready");
      } else if (arquivoUrl) {
        setResolvedUrl(arquivoUrl);
        setStatus("ready");
      } else {
        setStatus("error");
        setErrorMsg(t("documento.preview.naoDisponivel"));
      }
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e?.message ?? t("documento.preview.naoCarregou"));
    }
  }, [arquivoPath, arquivoUrl, t]);

  useEffect(() => {
    if (!open) {
      setResolvedUrl(null);
      setStatus("idle");
      setErrorMsg(null);
      return;
    }
    resolve();
  }, [open, resolve]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const result = await downloadStorageBlob(
        arquivoPath || arquivoUrl || "",
        fileName,
        "china-documentos",
      );
      if (result.blobUrl) {
        triggerBlobDownload(result.blobUrl, result.filename);
      } else {
        toast.error(result.error || t("documento.preview.naoCarregou"));
      }
    } finally {
      setDownloading(false);
    }
  };

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
          {status === "loading" ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : status === "error" || !resolvedUrl ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
              <p className="text-sm font-medium">{t("documento.preview.naoCarregou")}</p>
              {errorMsg && (
                <p className="text-xs text-muted-foreground max-w-md break-words">{errorMsg}</p>
              )}
              <Button size="sm" variant="outline" onClick={resolve} className="gap-1.5 mt-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </Button>
            </div>
          ) : showImage ? (
            <img
              src={resolvedUrl}
              alt={fileName}
              className="w-full h-auto rounded-md object-contain max-h-[60vh]"
              onError={() => {
                setStatus("error");
                setErrorMsg("Não foi possível carregar a imagem.");
              }}
            />
          ) : showPdf ? (
            <iframe
              src={resolvedUrl}
              className="w-full h-[60vh] rounded-md border"
              title={fileName}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("documento.preview.naoDisponivel")}</p>
              <p className="text-xs text-muted-foreground">
                Use o botão abaixo para baixar o arquivo.
              </p>
            </div>
          )}
        </div>

        {(status === "ready" || status === "error") && (arquivoPath || arquivoUrl) && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              className="gap-1.5"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t("documento.preview.download")}
            </Button>
            {resolvedUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={resolvedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  {t("documento.preview.abrir")}
                </a>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
