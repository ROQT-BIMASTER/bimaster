import { useState } from "react";
import { CheckCircle2, XCircle, Eye, Clock, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import { ChinaQuickReject } from "./ChinaQuickReject";
import type { ChinaInboxItem as InboxItem } from "@/hooks/useChinaInbox";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface Props {
  item: InboxItem;
  isBrasilUser: boolean;
  isChinaUser: boolean;
  onApprove: (item: InboxItem) => void;
  onReject: (item: InboxItem, motivo: string) => void;
  onView: (item: InboxItem) => void;
  onCorrigir?: (item: InboxItem) => void;
  loading?: boolean;
}

/**
 * Card único de uma pendência na Caixa de Entrada bilíngue.
 * Botões grandes, status reduzido a 3 estados visíveis.
 */
export function ChinaInboxItem({
  item, isBrasilUser, isChinaUser, onApprove, onReject, onView, onCorrigir, loading,
}: Props) {
  const { t } = useChinaI18n();
  const [rejectOpen, setRejectOpen] = useState(false);
  const cfg = CHINA_DOCUMENT_TYPES.find((t) => t.tipo === item.tipo_documento);

  const isUrgent = item.horas_pendentes >= 24;
  const isAjuste = item.status === "rejeitado";

  // Cores por urgência (mais simples que status técnico)
  const ringColor = isAjuste
    ? "border-l-destructive"
    : isUrgent
      ? "border-l-warning"
      : "border-l-primary";

  return (
    <>
      <div
        className={cn(
          "group flex items-start gap-3 p-3 sm:p-4 rounded-lg border border-l-4 bg-card transition-all hover:shadow-sm",
          ringColor,
        )}
      >
        {/* Ícone tipo */}
        <div className="shrink-0 h-10 w-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
          {cfg?.icon || <FileText className="h-5 w-5" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {cfg?.labelPt || item.tipo_documento}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {cfg?.labelCn || ""}
                </span>
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {item.produto_codigo} · {item.produto_nome}
                {item.numero_ordem ? ` · OC ${item.numero_ordem}` : ""}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              {isAjuste && (
                <Badge variant="destructive" className="text-[10px] h-4 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t("inbox.item.ajustar")}
                </Badge>
              )}
              {!isAjuste && isUrgent && (
                <Badge className="text-[10px] h-4 gap-1 bg-warning text-warning-foreground">
                  <Clock className="h-3 w-3" />
                  {t("inbox.toolbar.mais24h")}
                </Badge>
              )}
              {!isAjuste && !isUrgent && (
                <Badge variant="outline" className="text-[10px] h-4 gap-1">
                  <Clock className="h-3 w-3" />
                  {t("inbox.item.horasPendentes", { count: item.horas_pendentes })}
                </Badge>
              )}
            </div>
          </div>

          {item.nome_arquivo && (
            <p className="text-[11px] text-muted-foreground truncate mt-1">
              📎 {item.nome_arquivo}
            </p>
          )}

          {/* Ações */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onView(item)}
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              {t("inbox.item.ver")}
            </Button>

            {isBrasilUser && !isAjuste && (
              <>
                <Button
                  variant="success"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={loading}
                  onClick={() => onApprove(item)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  {t("inbox.item.aprovar")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setRejectOpen(true)}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  {t("inbox.item.pedirAjuste")}
                </Button>
              </>
            )}

            {isChinaUser && isAjuste && onCorrigir && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onCorrigir(item)}
              >
                {t("inbox.item.corrigir")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <ChinaQuickReject
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        loading={loading}
        onConfirm={(motivo) => {
          onReject(item, motivo);
          setRejectOpen(false);
        }}
      />
    </>
  );
}
