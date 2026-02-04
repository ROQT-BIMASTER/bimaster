import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDepartmentExpenses, DepartmentExpense, ExpenseAttachment } from "@/hooks/useDepartmentExpenses";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, Paperclip, Trash2, ExternalLink, FileText, Image, File } from "lucide-react";

interface DepartmentExpenseAttachmentsProps {
  expense: DepartmentExpense;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
}

export function DepartmentExpenseAttachments({ 
  expense, 
  open, 
  onOpenChange,
  departmentId 
}: DepartmentExpenseAttachmentsProps) {
  const { updateExpense } = useDepartmentExpenses(departmentId);
  const [uploading, setUploading] = useState(false);

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (type.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newAttachments: ExpenseAttachment[] = [...(expense.attachments || [])];

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${expense.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError, data } = await supabase.storage
          .from("department-expense-docs")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("department-expense-docs")
          .getPublicUrl(fileName);

        newAttachments.push({
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size,
          uploaded_at: new Date().toISOString(),
        });
      }

      await updateExpense.mutateAsync({
        id: expense.id,
        attachments: newAttachments,
      });

      toast.success(`${files.length} arquivo(s) anexado(s) com sucesso!`);
    } catch (error: any) {
      toast.error(`Erro ao fazer upload: ${error.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [expense, updateExpense]);

  const handleDelete = async (attachmentUrl: string) => {
    try {
      const newAttachments = expense.attachments.filter(a => a.url !== attachmentUrl);
      
      await updateExpense.mutateAsync({
        id: expense.id,
        attachments: newAttachments,
      });

      toast.success("Anexo removido com sucesso!");
    } catch (error: any) {
      toast.error(`Erro ao remover anexo: ${error.message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Anexos da Despesa
          </DialogTitle>
          <DialogDescription>
            {expense.code} - {expense.description || expense.category}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Section */}
          <div className="space-y-2">
            <Label>Adicionar Anexos</Label>
            <div className="flex gap-2">
              <Input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={handleUpload}
                disabled={uploading}
                className="flex-1"
              />
              {uploading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground">
              PDF, imagens, Word, Excel. Máximo 10MB por arquivo.
            </p>
          </div>

          {/* Attachments List */}
          <div className="space-y-2">
            <Label>Arquivos Anexados ({expense.attachments?.length || 0})</Label>
            
            {(!expense.attachments || expense.attachments.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum anexo</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {expense.attachments.map((attachment, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg border bg-muted/50"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getFileIcon(attachment.type)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(attachment.url, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(attachment.url)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
