import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Image, Video, FileSpreadsheet, Save, Send, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChinaUploadPreviewDialogProps {
  file: File | null;
  tipoLabel: { pt: string; cn: string };
  open: boolean;
  onClose: () => void;
  onConfirm: (file: File, status: "rascunho" | "pendente") => Promise<void>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="h-8 w-8 text-primary" />;
  if (type.startsWith("video/")) return <Video className="h-8 w-8 text-warning" />;
  if (type.includes("sheet") || type.includes("excel")) return <FileSpreadsheet className="h-8 w-8 text-success" />;
  return <FileText className="h-8 w-8 text-muted-foreground" />;
}

export function ChinaUploadPreviewDialog({
  file,
  tipoLabel,
  open,
  onClose,
  onConfirm,
}: ChinaUploadPreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState<"rascunho" | "pendente" | null>(null);

  useEffect(() => {
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [file]);

  const handleAction = async (status: "rascunho" | "pendente") => {
    if (!file) return;
    setSaving(status);
    try {
      await onConfirm(file, status);
      onClose();
    } finally {
      setSaving(null);
    }
  };

  if (!file) return null;

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            Validar Arquivo 验证文件
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {tipoLabel.pt} — {tipoLabel.cn}
          </p>
        </DialogHeader>

        {/* Preview area */}
        <div className="flex flex-col items-center gap-3 py-4">
          {isImage && previewUrl ? (
            <div className="w-full max-h-[300px] rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center">
              <img
                src={previewUrl}
                alt={file.name}
                className="max-w-full max-h-[300px] object-contain"
              />
            </div>
          ) : isVideo ? (
            <div className="w-full rounded-lg overflow-hidden border bg-muted/30 flex items-center justify-center p-8">
              <Video className="h-16 w-16 text-warning/50" />
            </div>
          ) : (
            <div className="w-full rounded-lg border bg-muted/30 flex items-center justify-center p-8">
              {getFileIcon(file.type)}
            </div>
          )}

          {/* File info */}
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground truncate max-w-[400px]">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)} · {file.type || "arquivo"}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={!!saving}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Cancelar 取消
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleAction("rascunho")}
            disabled={!!saving}
            className="gap-2"
          >
            {saving === "rascunho" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Rascunho 保存草稿
          </Button>
          <Button
            variant="gradient"
            onClick={() => handleAction("pendente")}
            disabled={!!saving}
            className="gap-2"
          >
            {saving === "pendente" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar ao Brasil 发送至巴西
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
