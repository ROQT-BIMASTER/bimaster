import { AlertOctagon, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SlaStatus = "em_risco" | "violado" | "cumprido";

interface SlaProtocoloBadgeProps {
  protocolo: string;
  status: SlaStatus;
  ticketId?: string | null;
  size?: "sm" | "md";
  onOpenTicket?: (ticketId: string) => void;
  className?: string;
}

const STATUS_CONFIG: Record<SlaStatus, { className: string; label: string; Icon: typeof AlertOctagon }> = {
  em_risco: {
    className: "bg-warning/15 text-warning border border-warning/50",
    label: "SLA em risco — chamado aberto na Central de Suporte",
    Icon: ShieldAlert,
  },
  violado: {
    className: "bg-destructive/15 text-destructive border border-destructive/60 font-semibold",
    label: "SLA violado — chamado aberto na Central de Suporte",
    Icon: AlertOctagon,
  },
  cumprido: {
    className: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40",
    label: "SLA cumprido — chamado encerrado",
    Icon: ShieldCheck,
  },
};

/**
 * Chip que exibe o número de protocolo do chamado de SLA (Camada 2)
 * aberto automaticamente na Central de Suporte quando o SLA da tarefa
 * é violado ou entra em risco. Clique abre o chamado vinculado.
 */
export function SlaProtocoloBadge({
  protocolo,
  status,
  ticketId,
  size = "sm",
  onOpenTicket,
  className,
}: SlaProtocoloBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const handleClick = () => {
    if (ticketId && onOpenTicket) onOpenTicket(ticketId);
  };
  const interactive = Boolean(ticketId && onOpenTicket);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={interactive ? handleClick : undefined}
            disabled={!interactive}
            className={cn(
              "inline-flex items-center gap-1 rounded-full whitespace-nowrap tabular-nums transition-colors",
              size === "md" ? "text-xs h-6 px-2.5" : "text-[10px] h-5 px-1.5",
              interactive && "hover:brightness-110 cursor-pointer",
              cfg.className,
              className,
            )}
            aria-label={`Protocolo ${protocolo} — ${cfg.label}`}
          >
            <cfg.Icon className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
            <span>#{protocolo}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <div className="font-semibold">{cfg.label}</div>
          <div className="text-muted-foreground">Protocolo: {protocolo}</div>
          {interactive && <div className="text-muted-foreground mt-1">Clique para abrir o chamado</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
