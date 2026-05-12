/**
 * DraftStatusIndicator — chip de status do auto-save de rascunho.
 * Estados: idle | saving | saved | error.
 *
 * Em "error" expõe botão para o usuário tentar novamente manualmente.
 */
import { Loader2, CheckCircle2, AlertTriangle, Save, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DraftSaveStatus } from "@/lib/china/draftRetry";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  status: DraftSaveStatus;
  lastSavedAt: Date | null;
  lastError: string | null;
  onRetry?: () => void;
}

export function DraftStatusIndicator({ status, lastSavedAt, lastError, onRetry }: Props) {
  if (status === "saving") {
    return (
      <Badge variant="secondary" className="text-xs gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando rascunho…
      </Badge>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="destructive" className="text-xs gap-1.5" title={lastError || undefined}>
          <AlertTriangle className="h-3 w-3" />
          Falha ao salvar
        </Badge>
        {onRetry && (
          <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs" onClick={onRetry}>
            <RefreshCw className="h-3 w-3" /> Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  if (status === "saved" && lastSavedAt) {
    return (
      <Badge variant="secondary" className="text-xs gap-1.5 bg-success/10 text-success border-success/30">
        <CheckCircle2 className="h-3 w-3" />
        Rascunho salvo {format(lastSavedAt, "HH:mm:ss", { locale: ptBR })}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-xs gap-1.5">
      <Save className="h-3 w-3" />
      Rascunho 草稿
    </Badge>
  );
}
