import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Paperclip, X, FileText, Image, Loader2, Download, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_at: string;
}

interface ExpenseAttachmentsProps {
  expenseId: string;
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  readOnly?: boolean;
}

export function ExpenseAttachments({
  expenseId,
  attachments,
  onAttachmentsChange,
  readOnly = false,
}: ExpenseAttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newAttachments: Attachment[] = [];

    try {
      for (const file of Array.from(files)) {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`Arquivo ${file.name} muito grande. Máximo 10MB.`);
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `${expenseId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("event-expense-docs")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("event-expense-docs")
          .getPublicUrl(fileName);

        newAttachments.push({
          name: file.name,
          url: urlData.publicUrl,
          type: file.type,
          size: file.size,
          uploaded_at: new Date().toISOString(),
        });
      }

      if (newAttachments.length > 0) {
        const updatedAttachments = [...attachments, ...newAttachments];
        onAttachmentsChange(updatedAttachments);
        toast.success(`${newAttachments.length} arquivo(s) anexado(s)`);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Erro ao enviar arquivos");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = async (index: number) => {
    const attachment = attachments[index];
    
    try {
      // Extract path from URL
      const urlParts = attachment.url.split("/event-expense-docs/");
      if (urlParts.length > 1) {
        const path = urlParts[1];
        await supabase.storage.from("event-expense-docs").remove([path]);
      }
      
      const updatedAttachments = attachments.filter((_, i) => i !== index);
      onAttachmentsChange(updatedAttachments);
      toast.success("Arquivo removido");
    } catch (error) {
      console.error("Error removing file:", error);
      toast.error("Erro ao remover arquivo");
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            Anexar Documentos
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, imagens, Word, Excel (máx. 10MB cada)
          </p>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-3 p-2 rounded-md border bg-muted/30",
                "hover:bg-muted/50 transition-colors"
              )}
            >
              <div className="flex-shrink-0 text-muted-foreground">
                {getFileIcon(attachment.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(attachment.url, "_blank")}
                  title="Visualizar"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  asChild
                >
                  <a href={attachment.url} download={attachment.name} title="Baixar">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(index)}
                    title="Remover"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && readOnly && (
        <p className="text-sm text-muted-foreground italic">
          Nenhum documento anexado
        </p>
      )}
    </div>
  );
}
