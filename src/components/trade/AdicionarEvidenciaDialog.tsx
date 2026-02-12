import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileCheck, Loader2, X, Paperclip } from "lucide-react";
import { getSafeErrorMessage } from "@/lib/utils/sanitize";

interface AdicionarEvidenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any;
  onSuccess: () => void;
}

export function AdicionarEvidenciaDialog({
  open,
  onOpenChange,
  entry,
  onSuccess,
}: AdicionarEvidenciaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState(entry.notes || "");
  const [documentUrl, setDocumentUrl] = useState(entry.document_url || "");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string }[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newFiles: { name: string; url: string }[] = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const filePath = `trade-evidencias/${entry.id}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("attachments")
          .getPublicUrl(filePath);

        newFiles.push({ name: file.name, url: urlData.publicUrl });
      }

      setUploadedFiles((prev) => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} arquivo(s) enviado(s)!`);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!notes.trim() && !documentUrl.trim() && uploadedFiles.length === 0) {
      toast.error("Adicione observações, URL ou faça upload de comprovantes");
      return;
    }

    setLoading(true);
    try {
      // Combine document_url and uploaded files
      const allUrls = [
        ...(documentUrl.trim() ? [documentUrl.trim()] : []),
        ...uploadedFiles.map((f) => f.url),
      ];

      const updateData: Record<string, any> = {
        notes: notes.trim(),
        status: "completed",
        updated_at: new Date().toISOString(),
      };

      if (allUrls.length === 1) {
        updateData.document_url = allUrls[0];
      } else if (allUrls.length > 1) {
        updateData.document_url = allUrls[0];
      }

      // If entry has attachments field, append uploaded files
      const existingAttachments = entry.attachments || [];
      const newAttachments = [
        ...existingAttachments,
        ...uploadedFiles.map((f) => f.url),
      ];
      if (newAttachments.length > 0) {
        updateData.attachments = newAttachments;
      }

      const { error } = await supabase
        .from("trade_financial_entries")
        .update(updateData)
        .eq("id", entry.id);

      if (error) throw error;

      toast.success("Evidências adicionadas com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Evidências</DialogTitle>
          <DialogDescription>
            Adicione observações e comprovantes da execução deste lançamento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-3 rounded-lg">
            <div>
              <p className="text-muted-foreground">Valor</p>
              <p className="font-semibold">
                R$ {parseFloat(entry.amount).toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Data</p>
              <p className="font-semibold">
                {new Date(entry.entry_date).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Descrição</p>
            <p className="text-sm">{entry.description}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações sobre a Execução *</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva como o lançamento foi executado, detalhes relevantes..."
              className="min-h-[120px]"
            />
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload de Comprovantes</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={uploading}
                onClick={() => document.getElementById("evidence-file-input")?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? "Enviando..." : "Selecionar Arquivos"}
              </Button>
              <input
                id="evidence-file-input"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-1 mt-2">
                {uploadedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => removeFile(idx)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Formatos aceitos: imagens, PDF, Word, Excel
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="document-url">Ou cole a URL do Comprovante</Label>
            <Input
              id="document-url"
              type="url"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              Cole a URL do documento armazenado (Google Drive, Dropbox, etc.)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || uploading}>
            <FileCheck className="h-4 w-4 mr-2" />
            Salvar Evidências
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
