import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Circle, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTAGIO_PILL_COLORS, STATUS_ICON_CONFIG } from "@/lib/projetoConstants";
import type { CalendarEvent, ColorStrategy } from "./types";

interface Props {
  event: CalendarEvent;
  darkBg?: boolean;
  compact?: boolean;
  colorStrategy?: ColorStrategy;
  onClick: () => void;
}

/**
 * Pílula refinada para o calendário unificado.
 * Mostra: cor do estágio/projeto, ícone de status, título truncado, indicador
 * de atraso e avatar do responsável (com tooltip).
 */
export function EventChip({ event, darkBg = false, compact = false, colorStrategy = "estagio", onClick }: Props) {
  const cfg = STATUS_ICON_CONFIG[event.status] || STATUS_ICON_CONFIG.pendente;
  const StatusIcon = cfg.completed ? CheckCircle2 : Circle;
  const isCompleted = cfg.completed;

  const isLate = !isCompleted && event.data_prazo
    ? new Date(event.data_prazo + "T23:59:59") < new Date()
    : false;

  const stageClass = ESTAGIO_PILL_COLORS[event.estagio || ""] || "bg-muted-foreground/50";
  const projColor = event.projeto?.cor;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={`${event.titulo}${event.responsavel ? ` — ${event.responsavel.nome}` : ""}${event.projeto ? ` · ${event.projeto.nome}` : ""}`}
      className={cn(
        "group relative flex items-center gap-1.5 w-full text-left rounded-md transition-all",
        "border border-transparent",
        compact ? "px-1 py-0.5" : "px-1.5 py-1",
        darkBg
          ? "hover:bg-white/[0.08] hover:border-white/10 hover:shadow-md"
          : "hover:bg-card hover:border-border/50 hover:shadow-md",
        isCompleted && "opacity-55",
      )}
      style={
        colorStrategy === "projeto" && projColor
          ? { backgroundColor: `${projColor}14`, borderLeft: `3px solid ${projColor}` }
          : undefined
      }
    >
      {/* Stage / project dot */}
      {colorStrategy === "estagio" ? (
        <span
          className={cn(
            "shrink-0 rounded-full",
            compact ? "w-1.5 h-1.5" : "w-2 h-2",
            stageClass,
            "shadow-[0_0_4px_currentColor]",
          )}
        />
      ) : (
        <span
          className={cn("shrink-0 rounded-full", compact ? "w-1.5 h-1.5" : "w-2 h-2")}
          style={{ backgroundColor: projColor ?? undefined }}
        />
      )}

      <StatusIcon className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0", cfg.className)} />

      <span
        className={cn(
          "truncate flex-1 leading-tight font-medium",
          compact ? "text-[10px]" : "text-[11px]",
          darkBg ? "text-white" : "text-foreground",
          isCompleted && "line-through",
        )}
      >
        {event.titulo}
      </span>

      {isLate && (
        <AlertTriangle className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0 text-destructive")} />
      )}

      {event.responsavel && !compact && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-4 w-4 shrink-0 ring-1 ring-background">
                <AvatarImage src={event.responsavel.avatar_url || undefined} />
                <AvatarFallback className="text-[7px]">
                  {event.responsavel.nome?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[11px]">
              {event.responsavel.nome}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </button>
  );
}
