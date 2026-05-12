import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTAGIO_PILL_COLORS, STATUS_ICON_CONFIG } from "@/lib/projetoConstants";
import type { CalendarEvent, ColorStrategy } from "./types";

interface Props {
  event: CalendarEvent;
  startCol: number;
  endCol: number;
  lane: number;
  continuesLeft?: boolean;
  continuesRight?: boolean;
  darkBg?: boolean;
  colorStrategy?: ColorStrategy;
  onClick: () => void;
}

const LANE_HEIGHT = 22;
const LANE_GAP = 2;

export function EventBar({
  event, startCol, endCol, lane, continuesLeft, continuesRight, darkBg, colorStrategy = "estagio", onClick,
}: Props) {
  const stageClass = ESTAGIO_PILL_COLORS[event.estagio || ""] || "bg-muted-foreground/50";
  const projColor = event.projeto?.cor;
  const cfg = STATUS_ICON_CONFIG[event.status] || STATUS_ICON_CONFIG.pendente;
  const isCompleted = cfg.completed;
  const isLate = !isCompleted && event.data_prazo
    ? new Date(event.data_prazo + "T23:59:59") < new Date()
    : false;

  const widthPct = ((endCol - startCol + 1) / 7) * 100;
  const leftPct = (startCol / 7) * 100;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={`${event.titulo}${event.responsavel ? ` — ${event.responsavel.nome}` : ""}${event.projeto ? ` · ${event.projeto.nome}` : ""}`}
      style={{
        position: "absolute",
        left: `calc(${leftPct}% + 4px)`,
        width: `calc(${widthPct}% - 8px)`,
        top: lane * (LANE_HEIGHT + LANE_GAP),
        height: LANE_HEIGHT,
        borderTopLeftRadius: continuesLeft ? 0 : 6,
        borderBottomLeftRadius: continuesLeft ? 0 : 6,
        borderTopRightRadius: continuesRight ? 0 : 6,
        borderBottomRightRadius: continuesRight ? 0 : 6,
        ...(colorStrategy === "projeto" && projColor
          ? { backgroundColor: `${projColor}26` }
          : {}),
      }}
      className={cn(
        "relative flex items-center gap-1.5 px-2 text-left transition-all overflow-hidden",
        "shadow-sm hover:shadow-md hover:-translate-y-px",
        colorStrategy === "estagio" && (darkBg ? "bg-white/[0.08] hover:bg-white/[0.14] text-white" : "bg-card hover:bg-accent text-foreground"),
        colorStrategy === "projeto" && (darkBg ? "text-white" : "text-foreground"),
        isCompleted && "opacity-60",
      )}
    >
      {/* Cor (estágio ou projeto) na borda esquerda */}
      <span
        aria-hidden
        className={cn("absolute left-0 top-0 bottom-0 w-[3px]", colorStrategy === "estagio" && stageClass)}
        style={{
          borderTopLeftRadius: continuesLeft ? 0 : 6,
          borderBottomLeftRadius: continuesLeft ? 0 : 6,
          ...(colorStrategy === "projeto" && projColor ? { backgroundColor: projColor } : {}),
        }}
      />
      {isCompleted && <CheckCircle2 className={cn("h-3 w-3 shrink-0 ml-0.5", cfg.className)} />}
      <span className={cn("truncate flex-1 text-[11px] font-medium leading-none", isCompleted && "line-through")}>
        {event.titulo}
      </span>
      {isLate && <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />}
      {event.responsavel && (
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

export const EVENT_LANE_HEIGHT = LANE_HEIGHT;
export const EVENT_LANE_GAP = LANE_GAP;
