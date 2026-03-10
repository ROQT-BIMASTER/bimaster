import { useCallback, useRef, useState } from "react";
import { Upload, CheckCircle2, Clock, XCircle, FileText, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BilingualLabel } from "./BilingualLabel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface DocumentSlotConfig {
  tipo: string;
  labelPt: string;
  labelCn: string;
  icon?: React.ReactNode;
  accept?: string;
  multiple?: boolean;
}

export interface SlotFile {
  id: string;
  name: string;
  status: string;
}

interface ChinaDocumentSlotProps {
  config: DocumentSlotConfig;
  /** Overall status — computed from files if not provided */
  status: "none" | "pendente" | "aprovado" | "rejeitado";
  /** @deprecated Use `files` instead */
  fileName?: string;
  /** Multiple files for this slot */
  files?: SlotFile[];
  observacao?: string;
  onUpload: (file: File) => Promise<void>;
  /** Remove a specific file by id */
  onRemoveFile?: (fileId: string) => void;
  /** @deprecated Use `onRemoveFile` */
  onRemove?: () => void;
  disabled?: boolean;
}

const statusConfig = {
  none: { color: "border-muted bg-muted/30", icon: null, label: "Pendente 待上传" },
  pendente: { color: "border-warning bg-warning/10", icon: <Clock className="h-4 w-4 text-warning" />, label: "Enviado 已发送" },
  aprovado: { color: "border-success bg-success/10", icon: <CheckCircle2 className="h-4 w-4 text-success" />, label: "Aprovado 已批准" },
  rejeitado: { color: "border-destructive bg-destructive/10", icon: <XCircle className="h-4 w-4 text-destructive" />, label: "Rejeitado 已拒绝" },
};

export function ChinaDocumentSlot({
  config,
  status,
  fileName,
  files,
  observacao,
  onUpload,
  onRemoveFile,
  onRemove,
  disabled,
}: ChinaDocumentSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Determine effective status from files array
  const effectiveStatus = files && files.length > 0
    ? (files.some(f => f.status === "rejeitado") ? "rejeitado"
      : files.some(f => f.status === "pendente") ? "pendente"
      : files.every(f => f.status === "aprovado") ? "aprovado"
      : status)
    : status;

  const s = statusConfig[effectiveStatus];
  const fileCount = files?.length ?? (fileName ? 1 : 0);

  const handleFiles = useCallback(async (fileList: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        await onUpload(file);
      }
    } finally {
      setUploading(false);
    }
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles?.length) handleFiles(droppedFiles);
  }, [handleFiles]);

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 border-dashed p-4 transition-all duration-200 flex flex-col items-center gap-2 min-h-[160px] justify-center",
        s.color,
        dragOver && "ring-2 ring-primary scale-[1.02]",
        disabled && "opacity-50 pointer-events-none"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Icon + Label */}
      <div className="flex flex-col items-center gap-1">
        <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
          {config.icon || <FileText className="h-5 w-5 text-muted-foreground" />}
        </div>
        <BilingualLabel pt={config.labelPt} cn={config.labelCn} size="sm" className="text-center" />
      </div>

      {/* File list (multi-file mode) */}
      {files && files.length > 0 ? (
        <ScrollArea className="w-full max-h-[72px]">
          <div className="space-y-1 w-full">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-1.5 text-xs text-foreground bg-background rounded-md px-2 py-0.5 max-w-full">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate flex-1 max-w-[100px]">{f.name}</span>
                {onRemoveFile && f.status !== "aprovado" && (
                  <button onClick={() => onRemoveFile(f.id)} className="text-destructive hover:text-destructive/80 shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : fileName ? (
        /* Legacy single-file mode */
        <div className="flex items-center gap-2 text-xs text-foreground bg-background rounded-md px-2 py-1 max-w-full">
          <FileText className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[120px]">{fileName}</span>
          {onRemove && status !== "aprovado" && (
            <button onClick={onRemove} className="text-destructive hover:text-destructive/80">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : null}

      {/* Upload button — always visible */}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs gap-1"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        Upload
      </Button>

      {/* Status badge + count */}
      <div className="flex items-center gap-1 text-[10px]">
        {s.icon}
        <span className="text-muted-foreground">{s.label}</span>
        {fileCount > 0 && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-1">
            {fileCount}
          </Badge>
        )}
      </div>

      {/* Observation */}
      {observacao && (
        <p className="text-[10px] text-destructive text-center px-1 line-clamp-2">{observacao}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={config.accept}
        multiple
        onChange={(e) => {
          const selectedFiles = e.target.files;
          if (selectedFiles?.length) handleFiles(selectedFiles);
          e.target.value = "";
        }}
      />
    </div>
  );
}
