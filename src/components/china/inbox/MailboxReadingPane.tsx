import { useEffect, useState } from "react";
import { ExternalLink, FileText, Star, MailOpen, Mail, ArrowLeft, Download, Clock, MessageSquare, ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { ChinaChatPanel } from "@/components/china/ChinaChatPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNavigate, useLocation } from "react-router-dom";
import { buildReturnToTarget } from "@/lib/navigation/withReturnTo";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { SnoozeMenu } from "@/components/china/inbox/SnoozeMenu";
import { exportSubmissaoPdf } from "@/lib/china/exportSubmissaoPdf";
import { useUnsnoozeSubmissao } from "@/hooks/useChinaInboxSnooze";
import { toast } from "sonner";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import { resolveDirection } from "@/lib/china/inboxDirection";
import { InboxDirectionBand } from "./InboxDirectionBadge";

interface Props {
  item: MailboxItem | null;
  isBrasilUser: boolean;
  isChinaUser: boolean;
  onApprove: (item: MailboxItem) => void;
  onReject: (item: MailboxItem, motivo: string) => void;
  onView: (item: MailboxItem) => void;
  onCorrigir: (item: MailboxItem) => void;
  onToggleRead: (item: MailboxItem) => void;
  onToggleStar: (item: MailboxItem) => void;
  onBack?: () => void;
  loading?: boolean;
}

export function MailboxReadingPane({
  item,
  isBrasilUser,
  isChinaUser,
  onApprove,
  onReject,
  onView,
  onCorrigir,
  onToggleRead,
  onToggleStar,
  onBack,
  loading,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const goWithReturn = (target: string) => {
    const fromPath = `${location.pathname}${location.search}`;
    const { url, state } = buildReturnToTarget(target, fromPath, { fromLabel: "Caixa de Entrada" });
    navigate(url, { state });
  };
  const [motivo, setMotivo] = useState("");
  const [chatOpen, setChatOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("china-inbox-chat-open") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("china-inbox-chat-open", chatOpen ? "1" : "0"); } catch { /* ignore */ }
  }, [chatOpen]);
  const unsnooze = useUnsnoozeSubmissao();

  const handleExportPdf = async () => {
    if (!item) return;
    try {
      await exportSubmissaoPdf(item);
      toast.success("PDF exportado");
    } catch (e: any) {
      toast.error(e.message || "Falha ao exportar PDF");
    }
  };

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center bg-card/20 text-center text-sm text-muted-foreground">
        <div className="space-y-1">
          <FileText className="mx-auto h-10 w-10 opacity-30" />
          <p>Selecione uma mensagem para visualizar.</p>
          <p className="text-xs">选择一条消息以查看。</p>
        </div>
      </div>
    );
  }

  const canBrasilApprove =
    isBrasilUser && item.doc_status && ["pendente", "enviado", "contestado"].includes(item.doc_status);
  const canChinaCorrigir = isChinaUser && (item.doc_status === "rejeitado" || item.submissao_status === "em_revisao");

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-1 border-b border-border bg-card/30 px-2 py-1.5">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => onToggleRead(item)}
        >
          {item.is_read ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}
          {item.is_read ? "Marcar não lida" : "Marcar lida"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 gap-1.5 text-xs", item.is_flagged && "text-amber-400")}
          onClick={() => onToggleStar(item)}
        >
          <Star className="h-3.5 w-3.5" fill={item.is_flagged ? "currentColor" : "none"} />
          {item.is_flagged ? "Desmarcar" : "Estrela"}
        </Button>
        <div className="ml-auto" />
        {!item.is_deleted && (
          <SnoozeMenu submissaoId={item.submissao_id} />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleExportPdf}
          title="Exportar registro em PDF"
        >
          <Download className="h-3.5 w-3.5" />
          PDF
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => goWithReturn(`/dashboard/fabrica-china/submissao/${item.submissao_id}`)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir submissão / 打开
        </Button>
      </div>

      {item.snooze_until && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Adiada até {format(new Date(item.snooze_until), "dd/MM/yy HH:mm")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] text-amber-200 hover:text-amber-50"
            onClick={() => unsnooze.mutate(item.submissao_id)}
          >
            Reativar agora
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5">
        <InboxDirectionBand
          info={resolveDirection(item, { isBrasilUser, isChinaUser })}
          className="mb-4"
        />
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">
              {item.produto_codigo} — {item.produto_nome}
            </h2>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase">
              {item.submissao_status}
            </Badge>
          </div>
          {item.numero_ordem && (
            <p className="text-xs text-muted-foreground">OC {item.numero_ordem}</p>
          )}
        </header>

        <Separator className="my-4" />

        {item.tipo_documento ? (
          <section className="space-y-2 rounded-md border border-border bg-card/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.tipo_documento}</p>
                {item.nome_arquivo && (
                  <p className="text-xs text-muted-foreground">{item.nome_arquivo}</p>
                )}
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onView(item)}>
                Pré-visualizar / 预览
              </Button>
            </div>
            {item.doc_status && (
              <p className="text-xs text-muted-foreground">
                Status do documento: <span className="text-foreground">{item.doc_status}</span> ·{" "}
                {item.horas_pendentes}h aguardando
              </p>
            )}
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">Esta submissão ainda não tem documentos anexados.</p>
        )}

        {(item.observacoes_china || item.observacoes_brasil) && (
          <section className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Observações / 备注
            </h3>
            {item.observacoes_china && (
              <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs">
                <p className="mb-1 text-[10px] font-semibold text-muted-foreground">CHINA</p>
                <p className="whitespace-pre-wrap text-foreground/90">{item.observacoes_china}</p>
              </div>
            )}
            {item.observacoes_brasil && (
              <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs">
                <p className="mb-1 text-[10px] font-semibold text-muted-foreground">BRASIL</p>
                <p className="whitespace-pre-wrap text-foreground/90">{item.observacoes_brasil}</p>
              </div>
            )}
          </section>
        )}

        {canBrasilApprove && (
          <section className="mt-6 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <ResponseTemplatePicker
                tipo="rejeitar"
                onPick={(t) => setMotivo((prev) => (prev ? `${prev}\n${t}` : t))}
              />
              <ResponseTemplatePicker
                tipo="aprovar"
                onPick={(t) => setMotivo(t)}
              />
              <span className="text-[10px] text-muted-foreground">
                Insere texto no campo abaixo
              </span>
            </div>
            <Textarea
              placeholder="Motivo do ajuste (obrigatório para rejeitar) / 调整原因"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onApprove(item)}
                disabled={loading}
              >
                <CheckCircle2 className="h-4 w-4" />
                Aprovar / 批准
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                onClick={() => motivo.trim() && onReject(item, motivo.trim())}
                disabled={loading || !motivo.trim()}
              >
                <AlertTriangle className="h-4 w-4" />
                Pedir ajuste / 修正
              </Button>
            </div>
          </section>
        )}

        {canChinaCorrigir && (
          <section className="mt-6">
            <Button size="sm" onClick={() => onCorrigir(item)} className="gap-1.5">
              <FileText className="h-4 w-4" />
              Abrir e corrigir / 打开并修改
            </Button>
          </section>
        )}

        {/* Conversa / 对话 — chat China-Brasil contextualizado nesta submissão */}
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs font-semibold hover:bg-card/60 transition-colors"
          >
            {chatOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            <span>Conversa / 对话</span>
          </button>
          {chatOpen && (
            <div className="mt-2 h-[480px] overflow-hidden rounded-md border border-border">
              <ChinaChatPanel
                key={item.submissao_id}
                submissaoId={item.submissao_id}
                produtoNome={item.produto_nome}
                tipoRemetente={isBrasilUser ? "brasil" : "china"}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
