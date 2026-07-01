import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { RequestAccessDialog } from "@/components/ui/request-access-dialog";

interface Props {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
  /** Chave usada para categorizar o pedido no admin (ex.: "china_produto_documentos_historico"). */
  resourceKind?: string;
  /** Id do recurso bloqueado (documento, lote, etc.) — quando disponível. */
  resourceId?: string | null;
  /** Rótulo humano do recurso (nome do produto, título do lote, etc.). */
  resourceLabel?: string | null;
  /** Oculta o botão "Solicitar acesso" quando não fizer sentido. */
  hideRequestAccess?: boolean;
}

/**
 * Aviso amigável para casos em que RLS/permissão bloqueia a leitura.
 * Não quebra a tela — renderiza um bloco discreto explicando a situação
 * e permite abrir um dialog para pedir acesso ao administrador.
 */
export function AccessDeniedNotice({
  title = "Sem permissão para visualizar",
  description = "Você não tem acesso a este conteúdo. Solicite acesso ao responsável ou a um administrador.",
  className,
  compact = false,
  resourceKind = "generico",
  resourceId = null,
  resourceLabel = null,
  hideRequestAccess = false,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        role="status"
        className={cn(
          "flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
          compact ? "p-2 text-[11px]" : "p-3 text-xs",
          className,
        )}
      >
        <ShieldAlert className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight">{title}</p>
          {description && (
            <p className="mt-0.5 opacity-80 leading-snug">{description}</p>
          )}
          {!hideRequestAccess && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                "mt-1.5 inline-flex items-center rounded border border-amber-500/40 bg-white/40 dark:bg-black/20 px-2 py-0.5 font-medium text-amber-900 dark:text-amber-100 hover:bg-white/70 dark:hover:bg-black/40 transition",
                compact ? "text-[10px]" : "text-[11px]",
              )}
              data-testid="access-denied-request-btn"
            >
              Solicitar acesso
            </button>
          )}
        </div>
      </div>
      {!hideRequestAccess && (
        <RequestAccessDialog
          open={open}
          onOpenChange={setOpen}
          resourceKind={resourceKind}
          resourceId={resourceId}
          resourceLabel={resourceLabel}
        />
      )}
    </>
  );
}
