import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AsanaBadgeProps {
  gid: string | null | undefined;
  className?: string;
}

/**
 * Pequeno indicador visual de tarefa importada do Asana.
 * Exibe um ponto rosa (#F06A6A — cor oficial do Asana) com tooltip do GID.
 */
export function AsanaBadge({ gid, className = "" }: AsanaBadgeProps) {
  if (!gid) return null;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center justify-center h-3.5 w-3.5 rounded-full shrink-0 ${className}`}
            style={{ backgroundColor: "#F06A6A" }}
            aria-label="Importada do Asana"
          >
            <span className="text-[8px] font-bold text-white leading-none">A</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Importada do Asana
          <div className="text-[10px] opacity-70 mt-0.5">GID: {gid}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
