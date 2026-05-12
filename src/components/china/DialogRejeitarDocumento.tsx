import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Paperclip, X } from "lucide-react";
import { useRejeitarComLaudo } from "@/hooks/useChinaRevisoes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentoId: string;
  submissaoId: string;
  tipoDocumentoLabel?: string;
  onSucesso?: () => void;
}

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024;

export function DialogRejeitarDocumento({
  open,
  onOpenChange,
  documentoId,
  submissaoId,
  tipoDocumentoLabel,
  onSucesso,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const rejeitar = useRejeitarComLaudo();

  function handleFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list);
    const validos = arr.filter((f) => f.size <= MAX_BYTES);
    setFiles((prev) => [...prev, ...validos].slice(0, MAX_FILES));
  }

  async function submit() {
    if (!motivo.trim()) return;
    await rejeitar.mutateAsync({
      documento_id: documentoId,
      submissao_id: submissaoId,
      motivo: motivo.trim(),
      anexos: files,
    });
    setMotivo("");
    setFiles([]);
    onOpenChange(false);
    onSucesso?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Rejeitar documento com laudo técnico
          </DialogTitle>
          <DialogDescription>
            {tipoDocumentoLabel ? `Documento: ${tipoDocumentoLabel}. ` : ""}
            O laudo técnico é obrigatório e ficará registrado na trilha de auditoria.
            A equipe da China receberá esta justificativa traduzida automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="motivo">Laudo técnico (motivo detalhado da rejeição) *</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={6}
              placeholder="Descreva tecnicamente o que está incorreto, qual norma/exigência não foi atendida e o que precisa ser ajustado…"
              maxLength={8000}
            />
            <p className="text-xs text-muted-foreground">
              {motivo.length}/8000 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="anexos">Anexos justificativos (opcional)</Label>
            <Input
              id="anexos"
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,image/*"
            />
            <p className="text-xs text-muted-foreground">
              Até {MAX_FILES} arquivos, 20MB cada. PDF, imagens, planilhas ou documentos.
            </p>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    <Paperclip className="h-3 w-3" />
                    {f.name}
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="ml-1 hover:text-destructive"
                      aria-label="Remover anexo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={rejeitar.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={!motivo.trim() || rejeitar.isPending}
          >
            {rejeitar.isPending ? "Enviando…" : "Confirmar rejeição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
