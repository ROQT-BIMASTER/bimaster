import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Circle, CheckCircle2, AlertTriangle, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTAGIO_PILL_COLORS, STATUS_ICON_CONFIG } from "@/lib/projetoConstants";
import type { CalendarEvent, ColorStrategy } from "./types";

interface Props {
  event: CalendarEvent;
  darkBg?: boolean;
  compact?: boolean;
  colorStrategy?: ColorStrategy;
  onClick: () => void;
  /** Habilita arraste para reagendar. */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLButtonElement>) => void;
}

/**
 * Pílula refinada para o calendário unificado.
 * Mostra: cor do estágio/projeto, ícone de status, título truncado, indicador
 * de atraso e avatar do responsável (com tooltip).
 */
export function EventChip({
  event, darkBg = false, compact = false, colorStrategy = "estagio", onClick,
  draggable = false, onDragStart, onDragEnd,
}: Props) {
  const isEvento = event.tipo === "evento";
  const cfg = STATUS_ICON_CONFIG[event.status] || STATUS_ICON_CONFIG.pendente;
  const StatusIcon = cfg.completed ? CheckCircle2 : Circle;
  const isCompleted = !isEvento && cfg.completed;

  const isLate = !isEvento && !isCompleted && event.data_prazo
    ? new Date(event.data_prazo + "T23:59:59") < new Date()
    : false;

  const stageClass = ESTAGIO_PILL_COLORS[event.estagio || ""] || "bg-muted-foreground/50";
  const projColor = event.cor ?? event.projeto?.cor;
  const useColor = isEvento || colorStrategy === "projeto";

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      title={`${event.titulo}${event.responsavel ? ` — ${event.responsavel.nome}` : ""}${event.projeto ? ` · ${event.projeto.nome}` : ""}`}
      className={cn(
        "group relative flex items-center gap-1.5 w-full text-left rounded-md transition-all",
        "border border-transparent",
        draggable && "cursor-grab active:cursor-grabbing",
        compact ? "px-1 py-0.5" : "px-1.5 py-1",
        darkBg
          ? "hover:bg-white/[0.08] hover:border-white/10 hover:shadow-md"
          : "hover:bg-card hover:border-border/50 hover:shadow-md",
        isCompleted && "opacity-55",
      )}
      style={
        useColor && projColor
          ? { backgroundColor: `${projColor}14`, borderLeft: `3px solid ${projColor}` }
          : undefined
      }
    >
      {/* Stage / project dot */}
      {!useColor ? (
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

      {isEvento ? (
        <CalendarClock className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0 text-muted-foreground")} />
      ) : (
        <StatusIcon className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0", cfg.className)} />
      )}

      {isEvento && event.hora_inicio && (
        <span className={cn("shrink-0 tabular-nums", compact ? "text-[9px]" : "text-[10px]", darkBg ? "text-white/70" : "text-muted-foreground")}>
          {event.hora_inicio}
        </span>
      )}

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
