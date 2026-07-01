import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
}

/**
 * Aviso amigável para casos em que RLS/permissão bloqueia a leitura.
 * Não quebra a tela — renderiza um bloco discreto explicando a situação.
 */
export function AccessDeniedNotice({
  title = "Sem permissão para visualizar",
  description = "Você não tem acesso a este conteúdo. Solicite acesso ao responsável ou a um administrador.",
  className,
  compact = false,
}: Props) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
        compact ? "p-2 text-[11px]" : "p-3 text-xs",
        className,
      )}
    >
      <ShieldAlert className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <div className="min-w-0">
        <p className="font-medium leading-tight">{title}</p>
        {description && (
          <p className="mt-0.5 opacity-80 leading-snug">{description}</p>
        )}
      </div>
    </div>
  );
}
