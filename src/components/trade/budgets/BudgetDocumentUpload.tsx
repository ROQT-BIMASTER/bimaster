import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, X, FileText, Loader2, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  name: string;
  path: string;
  url: string;
  type: string;
  size: number;
}

interface BudgetDocumentUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
}

export function BudgetDocumentUpload({ 
  files, 
  onFilesChange,
  maxFiles = 5 
}: BudgetDocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    if (files.length + selectedFiles.length > maxFiles) {
      toast.error(`Máximo de ${maxFiles} arquivos permitidos`);
      return;
    }

    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      for (const file of Array.from(selectedFiles)) {
        // Validar tamanho (máximo 10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} excede o limite de 10MB`);
          continue;
        }

        // Validar tipo
        const allowedTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (!allowedTypes.includes(file.type)) {
          toast.error(`${file.name}: tipo não permitido`);
          continue;
        }

        // Gerar path único
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const path = `temp/${user.id}/${timestamp}_${sanitizedName}`;

        // Upload
        const { error } = await supabase.storage
          .from("trade-budget-docs")
          .upload(path, file);

        if (error) {
          console.error("Upload error:", error);
          toast.error(`Erro ao enviar ${file.name}`);
          continue;
        }

        // Obter URL pública
        const { data: urlData } = supabase.storage
          .from("trade-budget-docs")
          .getPublicUrl(path);

        newFiles.push({
          name: file.name,
          path,
          url: urlData.publicUrl,
          type: file.type,
          size: file.size,
        });
      }

      if (newFiles.length > 0) {
        onFilesChange([...files, ...newFiles]);
        toast.success(`${newFiles.length} arquivo(s) enviado(s)`);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar arquivos");
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleRemoveFile = async (index: number) => {
    const fileToRemove = files[index];
    
    try {
      await supabase.storage
        .from("trade-budget-docs")
        .remove([fileToRemove.path]);
      
      onFilesChange(files.filter((_, i) => i !== index));
    } catch (error) {
      console.error("Remove error:", error);
      toast.error("Erro ao remover arquivo");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) {
      return "🖼️";
    }
    if (type === "application/pdf") {
      return "📄";
    }
    return "📎";
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Documentos de Aprovação (Opcional)
      </Label>
      
      <p className="text-xs text-muted-foreground">
        Anexe documentos assinados, comprovantes ou evidências de aprovação da verba
      </p>

      {/* Lista de arquivos */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 bg-muted/50 rounded-md"
            >
              <span className="text-lg">{getFileIcon(file.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleRemoveFile(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Botão de upload */}
      {files.length < maxFiles && (
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
            id="budget-doc-upload"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Anexar Documentos
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-1 text-center">
            PDF, imagens ou documentos Word (máx. 10MB cada)
          </p>
        </div>
      )}
    </div>
  );
}
