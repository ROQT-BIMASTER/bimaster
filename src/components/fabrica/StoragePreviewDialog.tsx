import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileWarning } from "lucide-react";
import { downloadStorageBlob, triggerBlobDownload, type StorageBlobResult } from "@/lib/utils/storage-download";
import { toast } from "sonner";

interface StoragePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  fileName?: string;
}

export function StoragePreviewDialog({ open, onOpenChange, filePath, fileName }: StoragePreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StorageBlobResult | null>(null);

  const cleanup = useCallback(() => {
    if (result?.blobUrl) {
      URL.revokeObjectURL(result.blobUrl);
    }
    setResult(null);
  }, [result]);

  useEffect(() => {
    if (!open || !filePath) {
      cleanup();
      return;
    }

    let cancelled = false;
    setLoading(true);

    downloadStorageBlob(filePath, fileName).then((res) => {
      if (cancelled) {
        if (res.blobUrl) URL.revokeObjectURL(res.blobUrl);
        return;
      }
      if (res.error) {
        toast.error(res.error);
      }
      setResult(res);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, filePath, fileName]);

  const handleClose = (v: boolean) => {
    if (!v) cleanup();
    onOpenChange(v);
  };

  const handleDownload = () => {
    if (result?.blobUrl) {
      triggerBlobDownload(result.blobUrl, result.filename || fileName || "arquivo");
    }
  };

  const isImage = result?.contentType?.startsWith("image/");
  const isPdf = result?.contentType === "application/pdf";
  const canPreview = isImage || isPdf;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="text-base truncate">
              {result?.filename || fileName || "Visualizar documento"}
            </DialogTitle>
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={!result?.blobUrl}>
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto bg-muted/30">
          {loading && (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && result?.error && (
            <div className="flex flex-col items-center justify-center h-96 gap-3 text-muted-foreground">
              <FileWarning className="h-12 w-12" />
              <p className="text-sm">{result.error}</p>
            </div>
          )}

          {!loading && result?.blobUrl && isImage && (
            <div className="flex items-center justify-center p-4">
              <img
                src={result.blobUrl}
                alt={result.filename}
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
          )}

          {!loading && result?.blobUrl && isPdf && (
            <iframe
              src={result.blobUrl}
              title={result.filename}
              className="w-full h-[75vh] border-0"
            />
          )}

          {!loading && result?.blobUrl && !canPreview && (
            <div className="flex flex-col items-center justify-center h-96 gap-4 text-muted-foreground">
              <FileWarning className="h-12 w-12" />
              <p className="text-sm">Pré-visualização não disponível para este tipo de arquivo.</p>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Baixar arquivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
