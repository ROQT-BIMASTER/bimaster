import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ExternalLink, FileText, FileImage, File, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveStorageUrl } from "@/lib/utils/storage-url";
import { useToast } from "@/hooks/use-toast";

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
}

interface AttachmentAcknowledgementProps {
  attachments: Attachment[];
  onAllAcknowledged: (allConfirmed: boolean) => void;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return FileImage;
  if (type === "application/pdf") return FileText;
  return File;
};

export function AttachmentAcknowledgement({
  attachments,
  onAllAcknowledged,
}: AttachmentAcknowledgementProps) {
  const [openedFiles, setOpenedFiles] = useState<Set<string>>(new Set());
  const [acknowledgedFiles, setAcknowledgedFiles] = useState<Set<string>>(new Set());
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [errorFiles, setErrorFiles] = useState<Map<string, string>>(new Map());
  const { toast } = useToast();

  // Notify parent when all files are acknowledged
  useEffect(() => {
    const allAcknowledged = attachments.length > 0 && acknowledgedFiles.size === attachments.length;
    onAllAcknowledged(allAcknowledged);
  }, [acknowledgedFiles, attachments.length, onAllAcknowledged]);

  const handleOpenFile = useCallback(async (url: string) => {
    // Mark as loading
    setLoadingFiles((prev) => new Set(prev).add(url));
    setErrorFiles((prev) => {
      const next = new Map(prev);
      next.delete(url);
      return next;
    });

    try {
      const { signedUrl, error } = await resolveStorageUrl(url);

      if (error || !signedUrl) {
        setErrorFiles((prev) => new Map(prev).set(url, error || 'Erro desconhecido'));
        toast({
          title: "Arquivo não encontrado",
          description: error || "Não foi possível acessar o arquivo anexado.",
          variant: "destructive",
        });
        return;
      }

      window.open(signedUrl, "_blank", "noopener,noreferrer");
      setOpenedFiles((prev) => new Set(prev).add(url));
    } catch {
      setErrorFiles((prev) =>
        new Map(prev).set(url, 'Erro ao acessar o armazenamento.')
      );
    } finally {
      setLoadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  }, [toast]);

  const handleAcknowledge = (url: string, checked: boolean) => {
    // Can only acknowledge if file was opened
    if (!openedFiles.has(url)) return;

    const updated = new Set(acknowledgedFiles);
    if (checked) {
      updated.add(url);
    } else {
      updated.delete(url);
    }
    setAcknowledgedFiles(updated);
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {attachments.map((attachment, index) => {
        const isOpened = openedFiles.has(attachment.url);
        const isAcknowledged = acknowledgedFiles.has(attachment.url);
        const isLoading = loadingFiles.has(attachment.url);
        const fileError = errorFiles.get(attachment.url);
        const FileIcon = getFileIcon(attachment.type);

        return (
          <div
            key={`${attachment.url}-${index}`}
            className="space-y-1"
          >
            <div
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                fileError
                  ? "border-destructive/50 bg-destructive/5"
                  : isAcknowledged
                  ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20"
                  : isOpened
                  ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20"
                  : "border-border bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileIcon className={cn(
                  "h-5 w-5 shrink-0",
                  fileError
                    ? "text-destructive"
                    : isAcknowledged
                    ? "text-emerald-600"
                    : "text-muted-foreground"
                )} />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{attachment.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <Button
                  type="button"
                  variant={isOpened ? "outline" : "default"}
                  size="sm"
                  onClick={() => handleOpenFile(attachment.url)}
                  className="gap-1"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : isOpened ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : fileError ? (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <ExternalLink className="h-3.5 w-3.5" />
                  )}
                  {isLoading ? "Abrindo..." : isOpened ? "Aberto" : fileError ? "Tentar novamente" : "Abrir"}
                </Button>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`ack-${index}`}
                    checked={isAcknowledged}
                    onCheckedChange={(checked) =>
                      handleAcknowledge(attachment.url, checked as boolean)
                    }
                    disabled={!isOpened}
                    className={cn(
                      !isOpened && "opacity-50 cursor-not-allowed"
                    )}
                  />
                  <Label
                    htmlFor={`ack-${index}`}
                    className={cn(
                      "text-xs cursor-pointer select-none",
                      !isOpened && "opacity-50 cursor-not-allowed",
                      isAcknowledged && "text-emerald-700 dark:text-emerald-400"
                    )}
                  >
                    Li e estou ciente
                  </Label>
                </div>
              </div>
            </div>

            {/* Error message */}
            {fileError && (
              <div className="flex items-center gap-2 px-3 text-xs text-destructive">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}
          </div>
        );
      })}

      <div className="text-xs text-muted-foreground text-center pt-2">
        {acknowledgedFiles.size} de {attachments.length} documento(s) confirmado(s)
      </div>
    </div>
  );
}
