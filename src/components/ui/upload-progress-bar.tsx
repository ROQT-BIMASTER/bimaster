/**
 * Barra de progresso reutilizável para uploads longos.
 * Consumida pelos dialogs de upload de anexos (Tarefa, Cofre, Documentos).
 */
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadProgressBarProps {
  fileName: string;
  percent: number;
  bytesSent?: number;
  totalBytes?: number;
  onCancel?: () => void;
  className?: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function UploadProgressBar({ fileName, percent, bytesSent, totalBytes, onCancel, className }: UploadProgressBarProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-md border bg-card p-3", className)}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-foreground" title={fileName}>{fileName}</span>
        <div className="flex items-center gap-2">
          <span className="tabular-nums text-muted-foreground">
            {typeof bytesSent === "number" && typeof totalBytes === "number"
              ? `${formatBytes(bytesSent)} / ${formatBytes(totalBytes)}`
              : `${percent}%`}
          </span>
          {onCancel ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={onCancel}
              aria-label="Cancelar upload"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      <Progress value={percent} />
    </div>
  );
}
