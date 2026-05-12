import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Paperclip, X, FileWarning, Languages, Loader2 } from "lucide-react";
import { useContestarComParecer, type Revisao } from "@/hooks/useChinaRevisoes";
import { TextoComTraducao } from "./TextoComTraducao";
import { useSalvarTraducaoRevisao } from "@/hooks/useChinaRevisoes";
import { useTraduzirTexto, type IdiomaTraducao } from "@/hooks/useTraduzirTexto";

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
  const [traducoesPreview, setTraducoesPreview] = useState<Partial<Record<IdiomaTraducao, string>> | null>(null);
  const [idiomaPreview, setIdiomaPreview] = useState<IdiomaTraducao>("pt");
  const contestar = useContestarComParecer();
  const salvarTraducao = useSalvarTraducaoRevisao();
  const traduzir = useTraduzirTexto();

  async function handleTraduzirParecer() {
    if (!parecer.trim()) return;
    try {
      const r = await traduzir.mutateAsync({ texto: parecer.trim() });
      setTraducoesPreview({ ...r.traducoes, [r.origem]: parecer.trim() });
      const alvo: IdiomaTraducao = r.origem === "pt" ? "zh" : "pt";
      setIdiomaPreview(alvo);
    } catch {
      // toast já exibido
    }
  }

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
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
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
            <Label htmlFor="parecer" className="text-sm font-semibold">
              Parecer técnico — resposta detalhada *
            </Label>
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5 text-[11px] text-muted-foreground bg-muted/40 rounded-t-lg">
                <span>Documento de resposta · escreva como em um e-mail ou parecer formal</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] gap-1"
                    onClick={handleTraduzirParecer}
                    disabled={!parecer.trim() || traduzir.isPending}
                  >
                    {traduzir.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                    Traduzir PT/ZH/EN
                  </Button>
                  <span>{parecer.length}/8000</span>
                </div>
              </div>
              <Textarea
                id="parecer"
                value={parecer}
                onChange={(e) => setParecer(e.target.value)}
                rows={16}
                placeholder={`Prezada equipe do Brasil,\n\nEm resposta ao laudo técnico recebido, segue o parecer detalhado:\n\n1. Análise do apontamento:\n   ...\n\n2. Alterações realizadas no documento:\n   ...\n\n3. Embasamento técnico / normativo:\n   ...\n\nAtenciosamente,\nEquipe China`}
                maxLength={8000}
                className="border-0 rounded-t-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[320px] font-serif text-[13px] leading-relaxed resize-y"
              />
            </div>
            {traducoesPreview && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-1 flex-wrap">
                  <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground mr-1">Pré-visualização da tradução:</span>
                  {(["pt", "zh", "en"] as IdiomaTraducao[]).map((l) => (
                    <Button
                      key={l}
                      type="button"
                      size="sm"
                      variant={idiomaPreview === l ? "default" : "outline"}
                      className="h-6 px-2 text-[11px]"
                      onClick={() => setIdiomaPreview(l)}
                      disabled={!traducoesPreview[l]}
                    >
                      {l === "pt" ? "Português" : l === "zh" ? "中文" : "English"}
                    </Button>
                  ))}
                </div>
                <div className="text-[13px] whitespace-pre-wrap break-words bg-card border rounded p-2 max-h-48 overflow-y-auto">
                  {traducoesPreview[idiomaPreview] || <span className="italic text-muted-foreground">Tradução indisponível</span>}
                </div>
              </div>
            )}
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
