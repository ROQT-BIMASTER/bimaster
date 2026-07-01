/**
 * DocumentoHistoricoDialog — Dialog que lista versões anteriores de um
 * documento China. Útil quando China envia v2 do PDF após Brasil rejeitar.
 *
 * Acionado por um botão "Ver histórico (N)" no card do documento na
 * Ficha Produto. Cada item mostra: status anterior, arquivo, quem mudou,
 * quando, e link pra baixar o arquivo daquela versão.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Loader2, Download, FileText, ArrowDownToLine, AlertCircle } from "lucide-react";
import { useChinaDocumentoHistorico, type DocumentoVersaoAnterior } from "@/hooks/useChinaDocumentoHistorico";
import { AccessDeniedNotice } from "@/components/ui/access-denied-notice";
import { isPermissionError } from "@/lib/utils/permissionErrors";
import { downloadStorageBlob, triggerBlobDownload } from "@/lib/utils/storage-download";
import { logRlsAccess } from "@/lib/audit/logRlsAccess";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentoId: string;
  tipoDocumentoLabel?: string;
}

function statusInfo(status: string): { label: string; cls: string } {
  if (status === "aprovado")  return { label: "Aprovado",  cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" };
  if (status === "rejeitado") return { label: "Rejeitado", cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" };
  if (status === "enviado")   return { label: "Enviado",   cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30" };
  if (status === "pendente")  return { label: "Pendente",  cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" };
  return { label: status, cls: "bg-muted text-muted-foreground" };
}

function acaoLabel(acao: DocumentoVersaoAnterior["acao"]): string {
  if (acao === "atualizado_arquivo") return "Nova versão do arquivo enviada";
  if (acao === "mudou_status") return "Status atualizado";
  if (acao === "deletado") return "Documento removido";
  return "Versão anterior";
}

export function DocumentoHistoricoDialog({ open, onOpenChange, documentoId, tipoDocumentoLabel }: Props) {
  const { data: versoes = [], isLoading, error } = useChinaDocumentoHistorico(open ? documentoId : null);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);

  // Auditoria: registra leitura permitida ou negada do histórico China
  useEffect(() => {
    if (!open || !documentoId || isLoading) return;
    if (isPermissionError(error)) {
      logRlsAccess({
        resourceType: "china_produto_documentos_historico",
        resourceId: documentoId,
        outcome: "denied",
        reason: "rls_denied_or_no_access",
        contexto: { tipo_documento: tipoDocumentoLabel ?? null },
      });
    } else if (!error) {
      logRlsAccess({
        resourceType: "china_produto_documentos_historico",
        resourceId: documentoId,
        outcome: "granted",
        contexto: { versoes: versoes.length, tipo_documento: tipoDocumentoLabel ?? null },
      });
    }
  }, [open, documentoId, isLoading, error, versoes.length, tipoDocumentoLabel]);


  const baixarVersao = async (path: string | null, nome: string | null) => {
    if (!path) {
      toast.error("Arquivo desta versão não está mais disponível");
      return;
    }
    setDownloadingPath(path);
    try {
      const r = await downloadStorageBlob(path, "china-documentos");
      if (!r) throw new Error("Falha ao baixar");
      triggerBlobDownload(r.blobUrl, nome || "documento");
    } catch (e: any) {
      toast.error("Erro ao baixar: " + (e?.message ?? ""));
    } finally {
      setDownloadingPath(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Histórico de versões
          </DialogTitle>
          <DialogDescription>
            {tipoDocumentoLabel
              ? `Versões anteriores deste documento (${tipoDocumentoLabel})`
              : "Versões anteriores deste documento"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-96 rounded border">
          {isLoading ? (
            <div className="p-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
            </div>
          ) : isPermissionError(error) ? (
            <div className="p-4">
              <AccessDeniedNotice
                title="Sem permissão para ver o histórico"
                description="Você não tem acesso à submissão deste documento. Solicite acesso ao responsável pela ficha na China."
                resourceKind="china_produto_documentos_historico"
                resourceId={documentoId}
                resourceLabel={tipoDocumentoLabel ?? "Documento China"}
              />
            </div>

          ) : versoes.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <AlertCircle className="h-6 w-6 text-muted-foreground/40" />
              <p>Sem versões anteriores ainda.</p>
              <p className="text-[10px] opacity-70">
                O histórico começa a ser registrado a partir da primeira mudança no documento.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {versoes.map((v, idx) => {
                const info = statusInfo(v.status);
                return (
                  <li key={v.id} className="p-3 hover:bg-muted/30">
                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            v{versoes.length - idx}
                          </Badge>
                          <Badge className={cn("text-[10px] h-4 px-1.5 border", info.cls)}>
                            {info.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {format(new Date(v.versionado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{acaoLabel(v.acao)}</p>
                        {v.nome_arquivo && (
                          <p className="text-xs font-medium truncate mt-0.5">{v.nome_arquivo}</p>
                        )}
                        {v.observacao && (
                          <p className="text-[11px] italic text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                            “{v.observacao}”
                          </p>
                        )}
                      </div>
                      {v.arquivo_path && v.acao !== "deletado" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 shrink-0 gap-1.5"
                          onClick={() => baixarVersao(v.arquivo_path, v.nome_arquivo)}
                          disabled={downloadingPath === v.arquivo_path}
                          title="Baixar esta versão"
                        >
                          {downloadingPath === v.arquivo_path ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ArrowDownToLine className="h-3 w-3" />
                          )}
                          <span className="text-[10px]">Baixar</span>
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
