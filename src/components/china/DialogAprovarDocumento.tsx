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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Eye, Paperclip, X } from "lucide-react";
import { MentionInput } from "@/components/projetos/MentionInput";
import { useChinaItemMentionableUsers } from "@/hooks/useChinaItemMentionableUsers";
import { useCriarRevisaoComParecer, useDarCienciaComParecer } from "@/hooks/useChinaRevisoes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentoId: string;
  submissaoId: string;
  tipoDocumentoLabel?: string;
  /** "aprovar" exige parecer; "ciencia" permite parecer opcional. */
  modo: "aprovar" | "ciencia";
}

const MAX_FILES = 5;
const MAX_BYTES = 20 * 1024 * 1024;

export function DialogAprovarDocumento({
  open,
  onOpenChange,
  documentoId,
  submissaoId,
  tipoDocumentoLabel,
  modo,
}: Props) {
  const [parecer, setParecer] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const aprovar = useCriarRevisaoComParecer();
  const ciencia = useDarCienciaComParecer();

  const { data: mentionables = [] } = useChinaItemMentionableUsers(submissaoId);

  const isAprovar = modo === "aprovar";
  const pending = isAprovar ? aprovar.isPending : ciencia.isPending;
  const disabled = !parecer.trim() || pending;

  function handleFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.size <= MAX_BYTES);
    setFiles((prev) => [...prev, ...arr].slice(0, MAX_FILES));
  }

  async function submit() {
    if (!parecer.trim()) return;
    const fn = isAprovar ? aprovar : ciencia;
    await fn.mutateAsync({
      documento_id: documentoId,
      submissao_id: submissaoId,
      parecer: parecer.trim(),
      mentions,
      anexos: files,
    });
    setParecer("");
    setMentions([]);
    setFiles([]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAprovar ? (
              <Check className="h-5 w-5 text-emerald-600" />
            ) : (
              <Eye className="h-5 w-5 text-sky-600" />
            )}
            {isAprovar ? "Aprovar documento" : "Registrar ciência"}
          </DialogTitle>
          <DialogDescription>
            {tipoDocumentoLabel ? `Documento: ${tipoDocumentoLabel}. ` : ""}
            {isAprovar
              ? "Registre o parecer técnico de aprovação. Ficará na trilha de auditoria."
              : "Descreva o que foi verificado nesta análise. O parecer fica registrado na trilha de auditoria e é obrigatório."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              {isAprovar ? "Parecer de aprovação *" : "Notas da análise *"}
            </Label>
            <MentionInput
              value={parecer}
              onChange={setParecer}
              onSubmit={() => {
                /* submit é manual */
              }}
              users={mentionables}
              placeholder={
                isAprovar
                  ? "Ex.: Documento conforme. Verificado contra norma X..."
                  : "Ex.: Confirmado layout, falta apenas...; use @ para mencionar colegas"
              }
              showSendButton={false}
              minRows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>Anexos de embasamento (opcional)</Label>
            <Input
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
            />
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    <Paperclip className="h-3 w-3" />
                    {f.name}
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="ml-1 hover:text-destructive"
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={disabled}>
            {pending
              ? "Enviando…"
              : isAprovar
              ? "Confirmar aprovação"
              : "Registrar ciência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
