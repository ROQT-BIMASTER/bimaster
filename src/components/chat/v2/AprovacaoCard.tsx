/**
 * AprovacaoCard — render de uma aprovação inline no chat.
 *
 * Substitui o balão normal quando `mensagens.metadata.aprovacao_id` está
 * presente. Mostra título, descrição, status, e os botões Aprovar/Rejeitar
 * quando:
 *   - status = 'pendente'
 *   - viewer NÃO é o solicitante
 *
 * Se status = aprovado/rejeitado, mostra quem decidiu e o motivo (se houver).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, ThumbsUp, ThumbsDown, Loader2, CheckCircle2, XCircle, Clock, FileText, Download, ShieldCheck, Archive, AlertOctagon } from "lucide-react";
import { useChatAprovacao } from "@/hooks/chat/useChatAprovacao";
import { useAprovacaoDocumentos } from "@/hooks/chat/useAprovacaoDocumentos";
import { ComprovanteAprovacaoDialog } from "./ComprovanteAprovacaoDialog";
import { VincularDocAprovadoDialog } from "./VincularDocAprovadoDialog";
import { CutucarDialog } from "./CutucarDialog";
import { downloadAprovacaoDoc } from "./aprovacaoDocs";
import { formatBytes } from "./utils";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  aprovacaoId: string;
  viewerUid: string;
  mine: boolean;
  /** Id da mensagem-âncora; usado para "Chamar atenção" sobre a aprovação. */
  mensagemId?: string;
}

export function AprovacaoCard({ aprovacaoId, viewerUid, mine, mensagemId }: Props) {
  const { data: ap, isLoading, decidir } = useChatAprovacao(aprovacaoId);
  const { data: documentos = [] } = useAprovacaoDocumentos(aprovacaoId);
  const [confirmaRejeicao, setConfirmaRejeicao] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [showComprovante, setShowComprovante] = useState(false);
  const [vincularDoc, setVincularDoc] = useState<typeof documentos[number] | null>(null);
  const [cutucarOpen, setCutucarOpen] = useState(false);

  const baixarDoc = async (doc: { storage_path: string; titulo: string }) => {
    try {
      await downloadAprovacaoDoc(doc.storage_path, doc.titulo);
    } catch (e: any) {
      toast.error("Erro ao baixar", { description: e?.message ?? "falha" });
    }
  };

  if (isLoading) {
    return (
      <div className={cn(
        "rounded-lg border p-3 max-w-md flex items-center gap-2 text-xs",
        mine ? "bg-white/10 border-white/30 text-white/80" : "bg-muted border-border text-muted-foreground",
      )}>
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando aprovação...
      </div>
    );
  }

  if (!ap) {
    return (
      <div className={cn(
        "rounded-lg border border-dashed p-3 max-w-md text-xs",
        mine ? "border-white/30 text-white/80" : "border-border text-muted-foreground",
      )}>
        Aprovação removida ou sem acesso
      </div>
    );
  }

  const isSolicitante = ap.solicitante_id === viewerUid;
  const podeDecidir = ap.status === "pendente" && !isSolicitante;
  const statusBadge = (() => {
    if (ap.status === "aprovado") return { label: "Aprovado", icon: <CheckCircle2 className="h-3 w-3" />, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" };
    if (ap.status === "rejeitado") return { label: "Rejeitado", icon: <XCircle className="h-3 w-3" />, cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" };
    if (ap.status === "cancelado") return { label: "Cancelado", icon: <XCircle className="h-3 w-3" />, cls: "bg-muted text-muted-foreground" };
    return { label: "Pendente", icon: <Clock className="h-3 w-3" />, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" };
  })();

  const aprovar = () => decidir.mutate({ status: "aprovado" });
  const confirmarRejeitar = () => {
    decidir.mutate(
      { status: "rejeitado", motivo: motivo.trim() || undefined },
      {
        onSuccess: () => {
          setConfirmaRejeicao(false);
          setMotivo("");
        },
      },
    );
  };

  return (
    <div className="rounded-lg border p-3 max-w-md w-full bg-card border-border text-foreground shadow-sm">
      <div className="flex items-center gap-2 mb-1.5">
        <ClipboardCheck className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pedido de aprovação
        </span>
        <Badge className={cn("ml-auto gap-1 text-[10px] h-4 px-1.5 border", statusBadge.cls)}>
          {statusBadge.icon} {statusBadge.label}
        </Badge>
      </div>

      <p className="text-sm font-medium leading-snug mb-1 text-foreground">{ap.titulo}</p>
      {ap.descricao && (
        <p className="text-xs whitespace-pre-wrap break-words leading-snug mb-2 text-muted-foreground">
          {ap.descricao}
        </p>
      )}

      {documentos.length > 0 && (
        <div className="mb-2 space-y-1 rounded-md border border-border bg-muted/30 p-1.5">
          {documentos.map((doc) => (
            <div
              key={doc.id}
              className="w-full flex items-center gap-2 text-xs rounded px-1 py-1 transition-colors hover:bg-background"
            >
              <button
                type="button"
                onClick={() => baixarDoc(doc)}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate text-foreground">{doc.titulo}</span>
                {doc.size_bytes != null && (
                  <span className="shrink-0 text-muted-foreground">
                    {formatBytes(doc.size_bytes)}
                  </span>
                )}
                <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
              {ap.status === "aprovado" && (
                <button
                  type="button"
                  onClick={() => setVincularDoc(doc)}
                  title="Vincular ao cofre oficial"
                  className="shrink-0 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border transition-colors border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Archive className="h-3 w-3" /> Vincular
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Botões de decisão (visíveis apenas quando pendente e viewer != solicitante) */}
      {podeDecidir && !confirmaRejeicao && (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={aprovar}
            disabled={decidir.isPending}
          >
            {decidir.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1 gap-1.5"
            onClick={() => setConfirmaRejeicao(true)}
            disabled={decidir.isPending}
          >
            <ThumbsDown className="h-3.5 w-3.5" /> Rejeitar
          </Button>
        </div>
      )}

      {/* Formulário de motivo da rejeição */}
      {podeDecidir && confirmaRejeicao && (
        <div className="mt-2 space-y-2">
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da rejeição (opcional)"
            rows={2}
            className="bg-background text-foreground"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1"
              onClick={() => { setConfirmaRejeicao(false); setMotivo(""); }}
              disabled={decidir.isPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={confirmarRejeitar}
              disabled={decidir.isPending}
            >
              {decidir.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar rejeição"}
            </Button>
          </div>
        </div>
      )}

      {/* Mensagem para solicitante quando pendente + ação de chamar atenção */}
      {ap.status === "pendente" && isSolicitante && (
        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-[10px] italic text-muted-foreground">
            Aguardando decisão de outro participante.
          </p>
          {mensagemId && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 gap-1 text-[10px] border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setCutucarOpen(true)}
            >
              <AlertOctagon className="h-3 w-3" /> Chamar atenção
            </Button>
          )}
        </div>
      )}

      {/* Detalhes da decisão */}
      {ap.status !== "pendente" && ap.decidido_em && (
        <div className="mt-2 pt-2 border-t text-[11px] border-border text-muted-foreground">
          <p>
            {ap.status === "aprovado" ? "Aprovado" : ap.status === "rejeitado" ? "Rejeitado" : "Cancelado"}
            {" em "}
            {format(new Date(ap.decidido_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
          {ap.motivo && (
            <p className="mt-1 whitespace-pre-wrap break-words">
              <strong>Motivo:</strong> {ap.motivo}
            </p>
          )}
          {ap.status === "aprovado" && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Assinado eletronicamente (trilha de auditoria)
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-[11px] text-primary"
                onClick={() => setShowComprovante(true)}
              >
                Ver comprovante
              </Button>
            </div>
          )}
        </div>
      )}

      <ComprovanteAprovacaoDialog
        aprovacaoId={aprovacaoId}
        open={showComprovante}
        onOpenChange={setShowComprovante}
      />

      <VincularDocAprovadoDialog
        open={!!vincularDoc}
        onOpenChange={(v) => { if (!v) setVincularDoc(null); }}
        documento={vincularDoc ? {
          id: vincularDoc.id,
          storage_path: vincularDoc.storage_path,
          titulo: vincularDoc.titulo,
          mime_type: (vincularDoc as any).mime_type ?? null,
          size_bytes: vincularDoc.size_bytes ?? null,
        } : null}
      />
    </div>
  );
}
