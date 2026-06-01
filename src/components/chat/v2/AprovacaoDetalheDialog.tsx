/**
 * AprovacaoDetalheDialog — visão de leitura de uma aprovação do chat, usada
 * na Central de Aprovações do Chat. Permite analisar os documentos anexados
 * (preview via StoragePreviewDialog ou download seguro via Blob).
 *
 * Não permite decidir aprovação aqui — o ato de aprovar/rejeitar continua
 * no chat (AprovacaoCard), preservando o contexto da conversa.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  Eye,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useChatAprovacao } from "@/hooks/chat/useChatAprovacao";
import { useAprovacaoDocumentos } from "@/hooks/chat/useAprovacaoDocumentos";
import { downloadAprovacaoDoc } from "./aprovacaoDocs";
import { formatBytes } from "./utils";
import { StoragePreviewDialog } from "@/components/fabrica/StoragePreviewDialog";
import { ComprovanteAprovacaoDialog } from "./ComprovanteAprovacaoDialog";

interface Props {
  aprovacaoId: string | null;
  solicitanteNome?: string;
  decidiodoNome?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AprovacaoDetalheDialog({
  aprovacaoId,
  solicitanteNome,
  decidiodoNome,
  open,
  onOpenChange,
}: Props) {
  const { data: ap, isLoading } = useChatAprovacao(open ? aprovacaoId : null);
  const { data: documentos = [], isLoading: docsLoading } = useAprovacaoDocumentos(
    open ? aprovacaoId : null,
  );
  const [preview, setPreview] = useState<{ path: string; titulo: string } | null>(null);
  const [showComprovante, setShowComprovante] = useState(false);

  const baixar = async (doc: { storage_path: string; titulo: string }) => {
    try {
      await downloadAprovacaoDoc(doc.storage_path, doc.titulo);
    } catch (e: any) {
      toast.error("Erro ao baixar", { description: e?.message ?? "falha" });
    }
  };

  const statusBadge = (() => {
    if (!ap) return null;
    if (ap.status === "aprovado")
      return { label: "Aprovado", icon: <CheckCircle2 className="h-3 w-3" />, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" };
    if (ap.status === "rejeitado")
      return { label: "Rejeitado", icon: <XCircle className="h-3 w-3" />, cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" };
    if (ap.status === "cancelado")
      return { label: "Cancelado", icon: <XCircle className="h-3 w-3" />, cls: "bg-muted text-muted-foreground" };
    return { label: "Pendente", icon: <Clock className="h-3 w-3" />, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" };
  })();

  const fmt = (d?: string | null) =>
    d ? format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Detalhes da aprovação
              {statusBadge && (
                <Badge className={cn("ml-2 gap-1 text-[10px] border", statusBadge.cls)}>
                  {statusBadge.icon} {statusBadge.label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {isLoading || !ap ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="max-h-[70vh] pr-2">
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Título</p>
                  <p className="font-medium">{ap.titulo}</p>
                </div>

                {ap.descricao && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Descrição</p>
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">{ap.descricao}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Solicitante</p>
                    <p>{solicitanteNome ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Solicitado em</p>
                    <p>{fmt(ap.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Decisor</p>
                    <p>{decidiodoNome ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Decidido em</p>
                    <p>{fmt(ap.decidido_em)}</p>
                  </div>
                </div>

                {ap.motivo && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Motivo</p>
                    <p className="whitespace-pre-wrap break-words">{ap.motivo}</p>
                  </div>
                )}

                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    Documentos ({documentos.length})
                  </p>
                  <div className="rounded-md border divide-y">
                    {docsLoading ? (
                      <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Carregando documentos...
                      </div>
                    ) : documentos.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">Nenhum documento anexado.</p>
                    ) : (
                      documentos.map((d) => (
                        <div key={d.id} className="p-2 flex items-start gap-2">
                          <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{d.titulo}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {d.size_bytes != null ? formatBytes(d.size_bytes) : "—"}
                              {d.hash_arquivo ? ` · SHA-256 ${d.hash_arquivo.slice(0, 12)}…` : ""}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 gap-1 text-xs"
                            onClick={() => setPreview({ path: d.storage_path, titulo: d.titulo })}
                          >
                            <Eye className="h-3.5 w-3.5" /> Visualizar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 gap-1 text-xs"
                            onClick={() => baixar(d)}
                          >
                            <Download className="h-3.5 w-3.5" /> Baixar
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {ap.status === "aprovado" && (
                  <div className="pt-2 border-t flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Assinado eletronicamente (Lei 14.063/2020)
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setShowComprovante(true)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" /> Ver comprovante
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {preview && (
        <StoragePreviewDialog
          open={!!preview}
          onOpenChange={(v) => { if (!v) setPreview(null); }}
          filePath={preview.path}
          fileName={preview.titulo}
          bucketHint="aprovacao-documentos"
        />
      )}

      {aprovacaoId && (
        <ComprovanteAprovacaoDialog
          aprovacaoId={aprovacaoId}
          open={showComprovante}
          onOpenChange={setShowComprovante}
        />
      )}
    </>
  );
}
