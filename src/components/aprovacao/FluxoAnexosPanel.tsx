import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Upload, RefreshCw, Download, Loader2, Eye } from "lucide-react";
import { useFluxoAnexos, useUploadFluxoAnexo, useSubstituirFluxoAnexo, type FluxoAnexo } from "@/hooks/useFluxoAprovacaoArtes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_OPTIONS = [
  { value: "documento", label: "Documento" },
  { value: "arte", label: "Arte" },
  { value: "evidencia", label: "Evidência" },
];

export function FluxoAnexosPanel({ instanciaId, etapaId, readOnly }: {
  instanciaId: string; etapaId?: string; readOnly?: boolean;
}) {
  const { data: anexos = [], isLoading } = useFluxoAnexos(instanciaId);
  const upload = useUploadFluxoAnexo();
  const substituir = useSubstituirFluxoAnexo();
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState("documento");
  const [observacao, setObservacao] = useState("");
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [showReplace, setShowReplace] = useState(false);

  // Only show current versions (not replaced)
  const currentAnexos = anexos.filter(a => !a.substituido_por);
  const replacedAnexos = anexos.filter(a => a.substituido_por);

  const handleUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    upload.mutate({ instanciaId, etapaId, file, tipo, observacao });
    setObservacao("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleReplace = (files: FileList | null) => {
    if (!files || files.length === 0 || !replaceId) return;
    const file = files[0];
    substituir.mutate({ anexoAntigoId: replaceId, instanciaId, etapaId, file, tipo, observacao });
    setShowReplace(false);
    setReplaceId(null);
    setObservacao("");
    if (replaceFileRef.current) replaceFileRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Documentos do Fluxo
          <Badge variant="outline" className="text-[10px] ml-auto">{currentAnexos.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Upload area */}
        {!readOnly && (
          <div className="border-2 border-dashed rounded-lg p-3 space-y-2">
            <div className="flex gap-2">
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Observação (opcional)"
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                className="h-8 text-xs flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" className="hidden" onChange={e => handleUpload(e.target.files)} />
              <Button
                size="sm" variant="outline" className="gap-1 text-xs"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
              >
                {upload.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Anexar Documento
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        ) : currentAnexos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Nenhum documento anexado</p>
        ) : (
          <div className="space-y-2">
            {currentAnexos.map(anexo => (
              <AnexoItem
                key={anexo.id}
                anexo={anexo}
                versaoAnterior={replacedAnexos.find(r => r.substituido_por === anexo.id)}
                onReplace={() => { setReplaceId(anexo.id); setShowReplace(true); }}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}

        {/* Replace Dialog */}
        <Dialog open={showReplace} onOpenChange={setShowReplace}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Substituir Documento</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              O documento anterior será mantido no histórico com registro de auditoria.
            </p>
            <Input
              placeholder="Observação sobre a substituição..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReplace(false)}>Cancelar</Button>
              <div>
                <input ref={replaceFileRef} type="file" className="hidden" onChange={e => handleReplace(e.target.files)} />
                <Button onClick={() => replaceFileRef.current?.click()} disabled={substituir.isPending}>
                  {substituir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Selecionar Novo Arquivo"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function AnexoItem({ anexo, versaoAnterior, onReplace, readOnly }: {
  anexo: FluxoAnexo; versaoAnterior?: FluxoAnexo; onReplace: () => void; readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20">
      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium truncate">{anexo.nome_arquivo}</span>
          <Badge variant="outline" className="text-[9px]">v{anexo.versao}</Badge>
          <Badge variant="secondary" className="text-[9px]">{anexo.tipo}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {anexo.uploaded_by_nome} • {format(new Date(anexo.created_at), "dd/MM HH:mm", { locale: ptBR })}
        </p>
        {anexo.observacao && (
          <p className="text-[10px] text-muted-foreground italic mt-0.5">{anexo.observacao}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
          <a href={anexo.arquivo_url} target="_blank" rel="noopener noreferrer">
            <Eye className="h-3 w-3" />
          </a>
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
          <a href={anexo.arquivo_url} download>
            <Download className="h-3 w-3" />
          </a>
        </Button>
        {!readOnly && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onReplace}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
