import { CheckCircle2, XCircle, Loader2, RefreshCw, X, Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export type UploadItemStatus = "queued" | "uploading" | "success" | "error";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: UploadItemStatus;
  /** 0-100. Para status "uploading" sem métrica real, usar animação. */
  progress: number;
  errorTitle?: string;
  errorMessage?: string;
}

interface Props {
  items: UploadItem[];
  onRetry?: (item: UploadItem) => void;
  onDismiss?: (item: UploadItem) => void;
  onClearFinished?: () => void;
}

function formatSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function UploadProgressList({ items, onRetry, onDismiss, onClearFinished }: Props) {
  if (items.length === 0) return null;

  const anyActive = items.some((i) => i.status === "uploading" || i.status === "queued");
  const anyFinished = items.some((i) => i.status === "success" || i.status === "error");

  return (
    <div
      className="mb-2 rounded-md border border-border/40 bg-muted/20 p-2"
      role="status"
      aria-live="polite"
      aria-label="Progresso de uploads"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Upload className="h-3.5 w-3.5" />
          {anyActive ? "Enviando anexos…" : "Uploads recentes"}
          <span className="text-[10px] text-muted-foreground/70">
            ({items.filter((i) => i.status === "success").length}/{items.length})
          </span>
        </div>
        {anyFinished && !anyActive && onClearFinished && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[10px]"
            onClick={onClearFinished}
          >
            Limpar
          </Button>
        )}
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => {
          const isUploading = item.status === "uploading";
          const isError = item.status === "error";
          const isSuccess = item.status === "success";
          return (
            <li
              key={item.id}
              className={`rounded-md border p-2 ${
                isError
                  ? "border-destructive/40 bg-destructive/5"
                  : isSuccess
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border/40 bg-background"
              }`}
            >
              <div className="flex items-center gap-2">
                {isUploading || item.status === "queued" ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                ) : isSuccess ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatSize(item.size)}
                    {item.status === "queued" && " • Na fila"}
                    {isUploading && " • Enviando…"}
                    {isSuccess && " • Concluído"}
                    {isError && ` • ${item.errorTitle ?? "Falha no envio"}`}
                  </p>
                </div>
                {isError && onRetry && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRetry(item)}
                    aria-label={`Tentar novamente ${item.name}`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
                {(isSuccess || isError) && onDismiss && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onDismiss(item)}
                    aria-label={`Remover ${item.name} da lista`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {(isUploading || item.status === "queued") && (
                <Progress
                  value={item.progress}
                  className={`mt-1.5 h-1 ${isUploading && item.progress < 100 ? "animate-pulse" : ""}`}
                />
              )}

              {isError && item.errorMessage && (
                <p className="mt-1 text-[10px] leading-snug text-destructive/90">
                  {item.errorMessage}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
