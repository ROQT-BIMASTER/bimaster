import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Forward, Loader2, Undo2, FileText, ExternalLink, Clock, User, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useRegistrarParecer, useDevolverChina, useTransicoesDespacho, type DespachoDocumento } from "@/hooks/useDespachoDocumentos";
import { useModulosDespachoResolved } from "@/hooks/useModulosDespacho";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ParecerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  despacho: DespachoDocumento | null;
  documentoNome?: string;
  documentoData?: any; // Full doc object with arquivo_url, tipo_documento, etc.
}

const ACOES = [
  { key: "aprovar", label: "Aprovar", icon: CheckCircle2, color: "text-green-600" },
  { key: "rejeitar", label: "Rejeitar", icon: XCircle, color: "text-destructive" },
  { key: "pendencia", label: "Pendência", icon: AlertTriangle, color: "text-warning" },
  { key: "encaminhar", label: "Encaminhar", icon: Forward, color: "text-primary" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  em_analise: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  aprovado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejeitado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  devolvido_china: "bg-muted text-muted-foreground",
};

export function ParecerDialog({ open, onOpenChange, despacho, documentoNome, documentoData }: ParecerDialogProps) {
  const modulosDisponiveis = useModulosDespachoResolved();
  const [acao, setAcao] = useState<string>("aprovar");
  const [texto, setTexto] = useState("");
  const [novoModulo, setNovoModulo] = useState("");
  const [devolverChina, setDevolverChina] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const registrarParecer = useRegistrarParecer();
  const devolverChinaMut = useDevolverChina();
  const { data: transicoes = [] } = useTransicoesDespacho(despacho?.id || null);

  // Resolve document URL
  useEffect(() => {
    if (!despacho || !open) return;
    const resolveUrl = async () => {
      // Try from documentoData first
      if (documentoData?.arquivo_url) {
        setDocUrl(documentoData.arquivo_url);
        return;
      }
      // Try fetching from china_produto_documentos
      const { data } = await supabase
        .from("china_produto_documentos")
        .select("arquivo_url, arquivo_path, tipo_documento, nome_arquivo")
        .eq("id", despacho.documento_id)
        .maybeSingle();
      if (data?.arquivo_url) {
        setDocUrl(data.arquivo_url);
      } else if (data?.arquivo_path) {
        const { data: urlData } = supabase.storage
          .from("china-documentos")
          .getPublicUrl(data.arquivo_path);
        setDocUrl(urlData?.publicUrl || null);
      }
    };
    resolveUrl();
  }, [despacho?.id, open, documentoData]);

  const handleSubmit = async () => {
    if (!despacho) return;

    await registrarParecer.mutateAsync({
      despacho_id: despacho.id,
      acao: acao as any,
      parecer_texto: texto,
      novo_departamento_id: acao === "encaminhar" ? novoModulo : undefined,
    });

    if (acao === "aprovar" && devolverChina) {
      await devolverChinaMut.mutateAsync({
        despacho_id: despacho.id,
        documento_id: despacho.documento_id,
      });
    }

    onOpenChange(false);
    setTexto("");
    setAcao("aprovar");
    setDevolverChina(false);
  };

  const isPending = registrarParecer.isPending || devolverChinaMut.isPending;
  const requiresText = acao === "rejeitar";

  if (!despacho) return null;

  const moduloInfo = despacho.modulo_destino
    ? modulosDisponiveis.find((m) => m.key === despacho.modulo_destino)
    : null;
    : null;

  const isImage = docUrl && /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(docUrl);
  const isPdf = docUrl && /\.pdf(\?|$)/i.test(docUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[85vh] p-0 gap-0 overflow-hidden">
        <div className="flex h-full">
          {/* LEFT: Document Preview */}
          <div className="flex-1 flex flex-col bg-muted/20 border-r border-border min-w-0">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium truncate">
                  Anexo {String(despacho.numero_anexo).padStart(2, "0")} — {documentoNome || "Documento"}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {despacho.categoria_checklist && (
                    <Badge variant="outline" className="text-[9px] h-4">{despacho.categoria_checklist}</Badge>
                  )}
                  {moduloInfo && (() => {
                    const MIcon = moduloInfo.icon;
                    return (
                      <Badge variant="secondary" className="text-[9px] h-4 gap-0.5">
                        <MIcon className={`h-2.5 w-2.5 ${moduloInfo.color}`} /> {moduloInfo.label}
                      </Badge>
                    );
                  })()}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[despacho.status] || STATUS_COLORS.pendente}`}>
                    {despacho.status}
                  </span>
                </div>
              </div>
              {docUrl && (
                <Button variant="outline" size="sm" className="shrink-0 gap-1 text-xs h-7" asChild>
                  <a href={docUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> Abrir original
                  </a>
                </Button>
              )}
            </div>

            <div className="flex-1 min-h-0 relative">
              {docUrl ? (
                isImage ? (
                  <div className="h-full flex items-center justify-center p-4 overflow-auto">
                    <img src={docUrl} alt={documentoNome} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
                  </div>
                ) : isPdf ? (
                  <iframe src={docUrl} className="w-full h-full border-0" title="Visualização do documento" />
                ) : (
                  <div className="h-full flex items-center justify-center p-4">
                    <iframe src={docUrl} className="w-full h-full border-0 rounded-lg" title="Visualização do documento" />
                  </div>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <FileText className="h-16 w-16 opacity-20" />
                  <p className="text-sm">Pré-visualização não disponível</p>
                  <p className="text-xs">O documento pode ser visualizado após download</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Parecer Form + Timeline */}
          <div className="w-[380px] shrink-0 flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Emitir Parecer</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Análise e decisão sobre o documento</p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Action buttons */}
              <div>
                <Label className="text-xs font-medium mb-2 block">Decisão</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ACOES.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Button
                        key={a.key}
                        variant={acao === a.key ? "default" : "outline"}
                        size="sm"
                        className="gap-1.5 justify-start text-xs h-9"
                        onClick={() => setAcao(a.key)}
                      >
                        <Icon className={`h-3.5 w-3.5 ${acao !== a.key ? a.color : ""}`} />
                        {a.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Module routing */}
              {acao === "encaminhar" && (
                <div>
                  <Label className="text-xs font-medium">Encaminhar para módulo</Label>
                  <Select value={novoModulo} onValueChange={setNovoModulo}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Selecione o módulo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DESPACHO_MODULOS_PROCESSO.map((m) => {
                        const MIcon = m.icon;
                        return (
                          <SelectItem key={m.key} value={m.key}>
                            <span className="flex items-center gap-1.5">
                              <MIcon className={`h-3.5 w-3.5 ${m.color}`} /> {m.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Justification */}
              <div>
                <Label className="text-xs font-medium">
                  Justificativa {requiresText && <span className="text-destructive">*</span>}
                </Label>
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={requiresText ? "Obrigatório informar o motivo da rejeição..." : "Observações do parecer..."}
                  rows={4}
                  className="mt-1.5"
                />
              </div>

              {/* Approve + return to China */}
              {acao === "aprovar" && (
                <label className="flex items-center gap-2 text-xs cursor-pointer p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <input
                    type="checkbox"
                    checked={devolverChina}
                    onChange={(e) => setDevolverChina(e.target.checked)}
                    className="rounded"
                  />
                  <Undo2 className="h-3.5 w-3.5 text-green-600" />
                  <span>Aprovar e devolver à China</span>
                </label>
              )}

              {/* Timeline */}
              {transicoes.length > 0 && (
                <div>
                  <Separator className="mb-3" />
                  <Label className="text-xs font-medium mb-2 block">Histórico de trâmite</Label>
                  <div className="space-y-2 border-l-2 border-muted pl-3">
                    {transicoes.map((t) => (
                      <div key={t.id} className="relative">
                        <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-primary" />
                        <div className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <Send className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-foreground capitalize">{t.acao}</span>
                          </div>
                          {t.usuario_nome && (
                            <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                              <User className="h-2.5 w-2.5" />
                              <span className="text-[10px]">{t.usuario_nome}</span>
                            </div>
                          )}
                          {t.observacao && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 italic">"{t.observacao}"</p>
                          )}
                          <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            <span className="text-[10px]">
                              {format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-background">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || (requiresText && !texto.trim()) || (acao === "encaminhar" && !novoModulo)}
                className="gap-1.5"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
