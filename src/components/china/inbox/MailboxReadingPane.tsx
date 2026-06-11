import { useEffect, useState } from "react";
import { ExternalLink, FileText, Star, MailOpen, Mail, ArrowLeft, Download, Clock, MessageSquare, ChevronDown, ChevronRight, Link2, Send, Loader2, AlertCircle, RotateCw, MoreHorizontal, Maximize2 } from "lucide-react";
import { ChinaChatPanel } from "@/components/china/ChinaChatPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { ChinaTimelineButton } from "@/components/china/timeline/ChinaTimelineButton";
import { useChinaI18n } from "@/hooks/useChinaI18n";
import { useChinaDocThumbnail } from "@/hooks/useChinaDocThumbnail";

interface Props {
  item: MailboxItem | null;
  isBrasilUser: boolean;
  isChinaUser: boolean;
  onView: (item: MailboxItem) => void;
  onCorrigir: (item: MailboxItem) => void;
  onEnviarBrasil?: (item: MailboxItem) => void;
  onToggleRead: (item: MailboxItem) => void;
  onToggleStar: (item: MailboxItem) => void;
  onBack?: () => void;
  loading?: boolean;
  error?: string | null;
  onRetryEnvio?: () => void;
  /** Compacta toolbar (esconde PDF/Abrir submissão num menu overflow). */
  compact?: boolean;
  /** Estado inicial do collapsible de Conversa (default: lê localStorage). */
  chatDefaultOpen?: boolean;
  /** Grupo da submissão (usado para renderizar o fluxo do checklist). */
  group?: import("@/lib/china/groupMailboxItems").MailboxGroup | null;
}

export function MailboxReadingPane({
  item,
  isBrasilUser,
  isChinaUser,
  onView,
  onCorrigir,
  onEnviarBrasil,
  onToggleRead,
  onToggleStar,
  onBack,
  loading,
  error,
  onRetryEnvio,
  compact,
  chatDefaultOpen,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useChinaI18n();
  const goWithReturn = (target: string) => {
    const fromPath = `${location.pathname}${location.search}`;
    const { url, state } = buildReturnToTarget(target, fromPath, { fromLabel: t("inbox.title") });
    navigate(url, { state });
  };

  const [chatOpen, setChatOpen] = useState<boolean>(() => {
    if (typeof chatDefaultOpen === "boolean") return chatDefaultOpen;
    try { return localStorage.getItem("china-inbox-chat-open") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    // Só persiste se a página não está forçando estado inicial
    if (typeof chatDefaultOpen === "boolean") return;
    try { localStorage.setItem("china-inbox-chat-open", chatOpen ? "1" : "0"); } catch { /* ignore */ }
  }, [chatOpen, chatDefaultOpen]);
  const [chatFullscreen, setChatFullscreen] = useState(false);
  const unsnooze = useUnsnoozeSubmissao();

  const handleExportPdf = async () => {
    if (!item) return;
    try {
      await exportSubmissaoPdf(item);
      toast.success(t("inbox.toasts.pdfOk"));
    } catch (e: any) {
      toast.error(e.message || t("inbox.toasts.pdfErro"));
    }
  };

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center bg-card/20 text-center text-sm text-muted-foreground">
        <div className="space-y-1">
          <FileText className="mx-auto h-10 w-10 opacity-30" />
          <p>{t("inbox.empty.selectMessage")}</p>
        </div>
      </div>
    );
  }

  const canBrasilApprove =
    isBrasilUser && item.doc_status && ["pendente", "enviado", "contestado"].includes(item.doc_status);
  const canChinaEnviar =
    isChinaUser &&
    !!onEnviarBrasil &&
    (item.submissao_status === "rascunho" || item.doc_status === "rascunho");
  const hasDocAnexo = !!item.tipo_documento;
  // Só conta como "Brasil solicitou ajustes" quando houver evidência concreta:
  // documento rejeitado OU observação textual enviada pelo Brasil.
  const hasObservacaoBrasil = !!(item.observacoes_brasil && item.observacoes_brasil.trim().length > 0);
  const canChinaCorrigir =
    isChinaUser && (item.doc_status === "rejeitado" || hasObservacaoBrasil);
  // China: documento já enviado e ainda em poder do Brasil — bloco read-only "aguardando"
  const chinaWaitingBrasil =
    isChinaUser &&
    !!item.doc_status &&
    ["pendente", "enviado", "contestado"].includes(item.doc_status) &&
    item.submissao_status !== "rejeitado";
  const brasilOpened = item.doc_status === "enviado" || item.doc_status === "contestado";
  const chinaApproved = isChinaUser && item.submissao_status === "aprovado";

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
          {item.is_read ? t("inbox.actions.marcarNaoLida") : t("inbox.actions.marcarLida")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 gap-1.5 text-xs", item.is_flagged && "text-amber-400")}
          onClick={() => onToggleStar(item)}
        >
          <Star className="h-3.5 w-3.5" fill={item.is_flagged ? "currentColor" : "none"} />
          {item.is_flagged ? t("inbox.actions.desmarcar") : t("inbox.actions.estrela")}
        </Button>
        <div className="ml-auto" />
        {!item.is_deleted && (
          <SnoozeMenu submissaoId={item.submissao_id} />
        )}
        {compact ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Mais ações">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleExportPdf}>
                <Download className="h-3.5 w-3.5 mr-2" />
                {t("inbox.actions.exportarPdf")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => goWithReturn(`/dashboard/fabrica-china/submissao/${item.submissao_id}`)}>
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                {t("inbox.actions.abrirSubmissao")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleExportPdf}
              title={t("inbox.actions.exportarPdfTitle")}
            >
              <Download className="h-3.5 w-3.5" />
              {t("inbox.actions.exportarPdf")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => goWithReturn(`/dashboard/fabrica-china/submissao/${item.submissao_id}`)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("inbox.actions.abrirSubmissao")}
            </Button>
          </>
        )}
      </div>

      {item.snooze_until && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {t("inbox.snoozeBanner.adiadaAte", { date: format(new Date(item.snooze_until), "dd/MM/yy HH:mm") })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] text-amber-200 hover:text-amber-50"
            onClick={() => unsnooze.mutate(item.submissao_id)}
          >
            {t("inbox.snoozeBanner.reativar")}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5">
        <InboxDirectionBand
          info={resolveDirection(item, { isBrasilUser, isChinaUser })}
          className="mb-4"
        />
        <header className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-lg font-semibold truncate">
                {item.produto_codigo} — {item.produto_nome}
              </h2>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase">
                {item.submissao_status}
              </Badge>
            </div>
            <ChinaTimelineButton
              scope={{ submissaoId: item.submissao_id }}
              variant="ghost"
              submissao={item}
            />
          </div>
          {item.numero_ordem && (
            <p className="text-xs text-muted-foreground">OC {item.numero_ordem}</p>
          )}
        </header>

        <Separator className="my-4" />

        {item.tipo_documento ? (
          <section className="space-y-2 rounded-md border border-border bg-card/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{item.tipo_documento}</p>
                {item.nome_arquivo && (
                  <p className="text-xs text-muted-foreground truncate">{item.nome_arquivo}</p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => onView(item)}
                title="Abrir em tela cheia"
              >
                {t("inbox.actions.preVisualizar")}
              </Button>
            </div>
            {(item.arquivo_path || item.arquivo_url) && !(item as any).is_virtual && (
              <InlineDocPreview item={item} onOpenFull={() => onView(item)} />
            )}
            {item.doc_status && (
              <p className="text-xs text-muted-foreground">
                {t("inbox.doc.statusPrefix")} <span className="text-foreground">{item.doc_status}</span> ·{" "}
                {t("inbox.doc.horasAguardando", { count: item.horas_pendentes })}
              </p>
            )}
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">{t("inbox.empty.noDocument")}</p>
        )}

        {(item.observacoes_china || item.observacoes_brasil) && (
          <section className="mt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              {t("inbox.doc.observacoes")}
            </h3>
            {item.observacoes_china && (
              <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs">
                <p className="mb-1 text-[10px] font-semibold text-muted-foreground">{t("inbox.doc.china")}</p>
                <p className="whitespace-pre-wrap text-foreground/90">{item.observacoes_china}</p>
              </div>
            )}
            {item.observacoes_brasil && (
              <div className="rounded-md border border-border bg-muted/30 p-2.5 text-xs">
                <p className="mb-1 text-[10px] font-semibold text-muted-foreground">{t("inbox.doc.brasil")}</p>
                <p className="whitespace-pre-wrap text-foreground/90">{item.observacoes_brasil}</p>
              </div>
            )}
          </section>
        )}

        {canChinaEnviar && hasDocAnexo && (
          <section className="mt-6 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-xs text-foreground/90 mb-2">
              {t("inbox.blocks.enviarTitulo")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onEnviarBrasil!(item)}
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {loading ? t("inbox.actions.enviandoBrasil") : t("inbox.actions.enviarBrasil")}
              </Button>
              {error && !loading && onRetryEnvio && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                  onClick={onRetryEnvio}
                >
                  <RotateCw className="h-4 w-4" />
                  {t("inbox.actions.tentarNovamente")}
                </Button>
              )}
            </div>
            {error && !loading && (
              <div
                role="alert"
                className="mt-2 flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-300"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold">{t("inbox.blocks.falhaEnviarBrasil")}</p>
                  <p className="mt-0.5 break-words text-rose-200/90">{error}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {canChinaEnviar && !hasDocAnexo && (
          <section className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs font-semibold text-amber-400 mb-1">
              {t("inbox.blocks.semDocsTitulo")}
            </p>
            <p className="text-[11px] text-muted-foreground mb-2">
              {t("inbox.blocks.semDocsTexto")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onCorrigir(item)}>
                <FileText className="h-4 w-4" />
                {t("inbox.actions.abrirAnexar")}
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600/60 text-white"
                disabled
              >
                <Send className="h-4 w-4" />
                {t("inbox.actions.enviarBrasil")}
              </Button>
            </div>
          </section>
        )}

        {canBrasilApprove && (
          <section className="mt-6 rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs text-foreground/90 mb-2">
              {t("inbox.blocks.brasilAprova")}
            </p>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => goWithReturn("/dashboard/projetos/vincular-china")}
              disabled={loading}
            >
              <Link2 className="h-4 w-4" />
              {t("inbox.actions.abrirVincular")}
            </Button>
          </section>
        )}

        {chinaWaitingBrasil && !canChinaCorrigir && (
          <section className="mt-6 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs font-semibold text-foreground/90">
              {brasilOpened ? t("inbox.blocks.emAnalise") : t("inbox.blocks.aguardando")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {brasilOpened
                ? t("inbox.blocks.emAnaliseTexto")
                : t("inbox.blocks.aguardandoTexto")}
              {" "}
              <span className="text-foreground/80">{t("inbox.blocks.horasDecorridas", { count: item.horas_pendentes })}</span>
            </p>
          </section>
        )}

        {chinaApproved && (
          <section className="mt-6 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-xs font-semibold text-emerald-400">
              {t("inbox.blocks.aprovadaPeloBrasil")}
            </p>
            {item.aprovado_em && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("inbox.blocks.aprovadaEm", { date: format(new Date(item.aprovado_em), "dd/MM/yy HH:mm") })}
              </p>
            )}
          </section>
        )}

        {canChinaCorrigir && (
          <section className="mt-6 rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
            <p className="text-xs font-semibold text-rose-400 mb-1">
              {t("inbox.blocks.brasilSolicitouAjustes")}
            </p>
            {item.observacoes_brasil && (
              <p className="mb-2 whitespace-pre-wrap text-[11px] text-foreground/90">
                {item.observacoes_brasil}
              </p>
            )}
            <Button size="sm" onClick={() => onCorrigir(item)} className="gap-1.5">
              <FileText className="h-4 w-4" />
              {t("inbox.actions.abrirCorrigir")}
            </Button>
          </section>
        )}

        {/* Conversa — chat China-Brasil contextualizado nesta submissão */}
        <section className="mt-6">
          <div className="flex w-full items-center gap-2 rounded-md border border-border bg-card/40 px-2 py-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className="flex flex-1 items-center gap-2 rounded-sm px-1 py-1 hover:bg-card/60 transition-colors text-left"
            >
              {chatOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              <span>{t("inbox.blocks.conversa")}</span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] font-normal text-muted-foreground hover:text-foreground"
              onClick={() => setChatFullscreen(true)}
              title="Abrir conversa em tela cheia"
            >
              <Maximize2 className="h-3 w-3" />
              Expandir
            </Button>
          </div>
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

      {/* Chat em tela cheia (Dialog) */}
      <Dialog open={chatFullscreen} onOpenChange={setChatFullscreen}>
        <DialogContent className="max-w-3xl p-0 flex flex-col h-[85vh]">
          <DialogHeader className="border-b border-border px-4 py-2.5">
            <DialogTitle className="text-sm font-semibold truncate">
              <MessageSquare className="inline h-4 w-4 mr-1.5 text-primary" />
              {t("inbox.blocks.conversa")} · {item.produto_codigo} — {item.produto_nome}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChinaChatPanel
              key={`fs-${item.submissao_id}`}
              submissaoId={item.submissao_id}
              produtoNome={item.produto_nome}
              tipoRemetente={isBrasilUser ? "brasil" : "china"}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InlineDocPreview({ item, onOpenFull }: { item: MailboxItem; onOpenFull: () => void }) {
  const { kind, url } = useChinaDocThumbnail({
    arquivoPath: item.arquivo_path,
    arquivoUrl: item.arquivo_url,
    nomeArquivo: item.nome_arquivo,
    enabled: true,
  });

  if (kind === "image") {
    return (
      <button
        type="button"
        onClick={onOpenFull}
        className="block w-full overflow-hidden rounded-md border border-border bg-muted/20 hover:border-primary/40 transition-colors"
        title="Abrir em tela cheia"
      >
        {url ? (
          <img
            src={url}
            alt={item.nome_arquivo ?? ""}
            loading="lazy"
            className="max-h-[320px] w-full object-contain bg-muted/20"
          />
        ) : (
          <div className="h-[200px] w-full animate-pulse bg-muted/40" />
        )}
      </button>
    );
  }

  if (kind === "pdf") {
    return (
      <button
        type="button"
        onClick={onOpenFull}
        className="flex w-full items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-left hover:bg-rose-500/10 transition-colors"
      >
        <FileText className="h-6 w-6 shrink-0 text-rose-500" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground/90 truncate">
            {item.nome_arquivo ?? "Documento PDF"}
          </p>
          <p className="text-[10px] text-muted-foreground">Clique para abrir em tela cheia</p>
        </div>
      </button>
    );
  }

  return null;
}
