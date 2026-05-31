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
import { ClipboardCheck, ThumbsUp, ThumbsDown, Loader2, CheckCircle2, XCircle, Clock, FileText, Download, ShieldCheck, Archive } from "lucide-react";
import { useChatAprovacao } from "@/hooks/chat/useChatAprovacao";
import { useAprovacaoDocumentos } from "@/hooks/chat/useAprovacaoDocumentos";
import { ComprovanteAprovacaoDialog } from "./ComprovanteAprovacaoDialog";
import { VincularDocAprovadoDialog } from "./VincularDocAprovadoDialog";
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
}

export function AprovacaoCard({ aprovacaoId, viewerUid, mine }: Props) {
  const { data: ap, isLoading, decidir } = useChatAprovacao(aprovacaoId);
  const { data: documentos = [] } = useAprovacaoDocumentos(aprovacaoId);
  const [confirmaRejeicao, setConfirmaRejeicao] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [showComprovante, setShowComprovante] = useState(false);

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
    <div className={cn(
      "rounded-lg border p-3 max-w-md w-full",
      mine ? "bg-white/10 border-white/30 text-white" : "bg-card border-border",
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        <ClipboardCheck className={cn("h-4 w-4 shrink-0", mine ? "text-white" : "text-primary")} />
        <span className={cn("text-[10px] font-semibold uppercase tracking-wider", mine ? "text-white/70" : "text-muted-foreground")}>
          Pedido de aprovação
        </span>
        <Badge className={cn("ml-auto gap-1 text-[10px] h-4 px-1.5 border", statusBadge.cls)}>
          {statusBadge.icon} {statusBadge.label}
        </Badge>
      </div>

      <p className={cn("text-sm font-medium leading-snug mb-1", mine && "text-white")}>{ap.titulo}</p>
      {ap.descricao && (
        <p className={cn("text-xs whitespace-pre-wrap break-words leading-snug mb-2",
          mine ? "text-white/80" : "text-muted-foreground")}>
          {ap.descricao}
        </p>
      )}

      {documentos.length > 0 && (
        <div className={cn("mb-2 space-y-1 rounded-md border p-1.5",
          mine ? "border-white/30" : "border-border bg-muted/30")}>
          {documentos.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => baixarDoc(doc)}
              className={cn(
                "w-full flex items-center gap-2 text-left text-xs rounded px-1 py-1 transition-colors",
                mine ? "hover:bg-white/10" : "hover:bg-background",
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 min-w-0 truncate">{doc.titulo}</span>
              {doc.size_bytes != null && (
                <span className={cn("shrink-0", mine ? "text-white/60" : "text-muted-foreground")}>
                  {formatBytes(doc.size_bytes)}
                </span>
              )}
              <Download className="h-3.5 w-3.5 shrink-0" />
            </button>
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
            className={cn(mine && "bg-background text-foreground")}
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

      {/* Mensagem para solicitante quando pendente */}
      {ap.status === "pendente" && isSolicitante && (
        <p className={cn("mt-2 text-[10px] italic",
          mine ? "text-white/60" : "text-muted-foreground")}>
          Aguardando decisão de outro participante.
        </p>
      )}

      {/* Detalhes da decisão */}
      {ap.status !== "pendente" && ap.decidido_em && (
        <div className={cn("mt-2 pt-2 border-t text-[11px]",
          mine ? "border-white/30 text-white/80" : "border-border text-muted-foreground")}>
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
                className={cn("h-auto p-0 text-[11px]", mine ? "text-white" : "text-primary")}
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
    </div>
  );
}
