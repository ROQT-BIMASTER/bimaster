import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Paperclip, X, FileWarning } from "lucide-react";
import { useContestarComParecer, type Revisao } from "@/hooks/useChinaRevisoes";
import { TextoComTraducao } from "./TextoComTraducao";
import { useSalvarTraducaoRevisao } from "@/hooks/useChinaRevisoes";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentoId: string;
  submissaoId: string;
  tipoDocumento: string;
  tipoDocumentoLabel?: string;
  laudoRevisao?: Revisao | null;
  onSucesso?: () => void;
}

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024;

export function DialogContestarDocumento({
  open,
  onOpenChange,
  documentoId,
  submissaoId,
  tipoDocumento,
  tipoDocumentoLabel,
  laudoRevisao,
  onSucesso,
}: Props) {
  const [parecer, setParecer] = useState("");
  const [novoArquivo, setNovoArquivo] = useState<File | null>(null);
  const [anexos, setAnexos] = useState<File[]>([]);
  const contestar = useContestarComParecer();
  const salvarTraducao = useSalvarTraducaoRevisao();

  function handleAnexos(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.size <= MAX_BYTES);
    setAnexos((prev) => [...prev, ...arr].slice(0, MAX_FILES));
  }

  async function submit() {
    if (!parecer.trim() || !novoArquivo) return;
    await contestar.mutateAsync({
      documento_id: documentoId,
      submissao_id: submissaoId,
      tipo_documento: tipoDocumento,
      parecer: parecer.trim(),
      novo_arquivo: novoArquivo,
      anexos,
    });
    setParecer("");
    setNovoArquivo(null);
    setAnexos([]);
    onOpenChange(false);
    onSucesso?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Substituir documento com parecer técnico
          </DialogTitle>
          <DialogDescription>
            {tipoDocumentoLabel ? `Documento: ${tipoDocumentoLabel}. ` : ""}
            A versão anterior será arquivada como histórico (auditoria) e o novo arquivo
            entrará para nova análise do Brasil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {laudoRevisao?.motivo_rejeicao && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <FileWarning className="h-4 w-4" />
                Laudo técnico do Brasil — rodada {laudoRevisao.rodada}
              </div>
              <TextoComTraducao
                texto={laudoRevisao.motivo_rejeicao}
                idiomaOrigem={laudoRevisao.motivo_idioma_origem}
                traducoes={laudoRevisao.motivo_traducoes}
                onCacheTraducao={(p) =>
                  salvarTraducao.mutate({
                    revisao_id: laudoRevisao.id,
                    submissao_id: submissaoId,
                    campo: "motivo",
                    traducoes: p.traducoes,
                    origem: p.origem,
                  })
                }
              />
              {laudoRevisao.anexos?.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Anexos: {laudoRevisao.anexos.map((a) => a.nome).join(", ")}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="parecer">Parecer técnico (resposta detalhada) *</Label>
            <Textarea
              id="parecer"
              value={parecer}
              onChange={(e) => setParecer(e.target.value)}
              rows={6}
              placeholder="Explique tecnicamente as alterações feitas, o embasamento técnico e por que o novo documento atende às exigências…"
              maxLength={8000}
            />
            <p className="text-xs text-muted-foreground">{parecer.length}/8000 caracteres</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="novo">Novo arquivo principal *</Label>
            <Input
              id="novo"
              type="file"
              onChange={(e) => setNovoArquivo(e.target.files?.[0] || null)}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx"
            />
            {novoArquivo && (
              <Badge variant="secondary" className="gap-1">
                <Paperclip className="h-3 w-3" />
                {novoArquivo.name}
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="emb">Anexos de embasamento técnico (opcional)</Label>
            <Input
              id="emb"
              type="file"
              multiple
              onChange={(e) => handleAnexos(e.target.files)}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx"
            />
            <p className="text-xs text-muted-foreground">
              Até {MAX_FILES} arquivos, 20MB cada.
            </p>
            {anexos.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {anexos.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    <Paperclip className="h-3 w-3" />
                    {f.name}
                    <button
                      type="button"
                      onClick={() => setAnexos((prev) => prev.filter((_, idx) => idx !== i))}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={contestar.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!parecer.trim() || !novoArquivo || contestar.isPending}
          >
            {contestar.isPending ? "Enviando…" : "Enviar correção ao Brasil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
