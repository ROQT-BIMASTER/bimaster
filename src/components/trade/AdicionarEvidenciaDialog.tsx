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
import { Upload, FileCheck } from "lucide-react";
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
  const [notes, setNotes] = useState(entry.notes || "");
  const [documentUrl, setDocumentUrl] = useState(entry.document_url || "");

  const handleSubmit = async () => {
    if (!notes.trim() && !documentUrl.trim()) {
      toast.error("Por favor, adicione observações ou URL do comprovante");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("trade_financial_entries")
        .update({
          notes: notes.trim(),
          document_url: documentUrl.trim() || null,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
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

          <div className="space-y-2">
            <Label htmlFor="document-url">URL do Comprovante</Label>
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
          <Button onClick={handleSubmit} disabled={loading}>
            <FileCheck className="h-4 w-4 mr-2" />
            Salvar Evidências
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
