import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTAGIO_PILL_COLORS, STATUS_ICON_CONFIG } from "@/lib/projetoConstants";
import type { ProjetoTarefa } from "@/hooks/useProjetoTarefas";

interface Props {
  tarefa: ProjetoTarefa;
  startCol: number;
  endCol: number;
  lane: number;
  /** Continuação visual à esquerda (segmento que começa em outra linha-semana). */
  continuesLeft?: boolean;
  /** Continuação visual à direita. */
  continuesRight?: boolean;
  darkBg?: boolean;
  onClick: () => void;
}

const LANE_HEIGHT = 22;
const LANE_GAP = 2;

export function MultiDayBar({
  tarefa, startCol, endCol, lane, continuesLeft, continuesRight, darkBg, onClick,
}: Props) {
  const stageColor = ESTAGIO_PILL_COLORS[tarefa.estagio || ""] || "bg-muted-foreground/50";
  const cfg = STATUS_ICON_CONFIG[tarefa.status] || STATUS_ICON_CONFIG.pendente;
  const isCompleted = cfg.completed;
  const isLate = !isCompleted && tarefa.data_prazo
    ? new Date(tarefa.data_prazo + "T23:59:59") < new Date()
    : false;

  const widthPct = ((endCol - startCol + 1) / 7) * 100;
  const leftPct = (startCol / 7) * 100;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
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
      }}
      className={cn(
        "flex items-center gap-1.5 px-1.5 text-left transition-all overflow-hidden",
        "shadow-sm hover:shadow-md hover:-translate-y-px",
        darkBg ? "bg-white/[0.08] hover:bg-white/[0.14] text-white" : "bg-card hover:bg-accent text-foreground",
        "border-l-[3px]",
        isCompleted && "opacity-60",
      )}
    >
      {/* Estágio na borda esquerda (substitui o border-l) */}
      <span
        aria-hidden
        className={cn("absolute left-0 top-0 bottom-0 w-[3px]", stageColor)}
        style={{
          borderTopLeftRadius: continuesLeft ? 0 : 6,
          borderBottomLeftRadius: continuesLeft ? 0 : 6,
        }}
      />
      {isCompleted && <CheckCircle2 className={cn("h-3 w-3 shrink-0", cfg.className)} />}
      <span className={cn(
        "truncate flex-1 text-[11px] font-medium leading-none",
        isCompleted && "line-through",
      )}>
        {tarefa.titulo}
      </span>
      {isLate && <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />}
      {tarefa.responsavel && (
        <Avatar className="h-4 w-4 shrink-0 ring-1 ring-background">
          <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
          <AvatarFallback className="text-[7px]">{tarefa.responsavel.nome?.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
    </button>
  );
}

export const MULTIDAY_LANE_HEIGHT = LANE_HEIGHT;
export const MULTIDAY_LANE_GAP = LANE_GAP;
