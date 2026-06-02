import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Circle, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTAGIO_PILL_COLORS, STATUS_ICON_CONFIG } from "@/lib/projetoConstants";
import type { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { getToday, parseLocalDate } from "@/utils/dateUtils";

interface Props {
  tarefa: ProjetoTarefa;
  darkBg?: boolean;
  compact?: boolean;
  onClick: () => void;
}

/**
 * Pílula refinada para o calendário de Projetos.
 *
 * Visual inspirado no Asana: avatar à esquerda, dot de estágio com glow sutil,
 * título truncado, ícone de status e indicador de atraso.
 */
export function CalendarioCard({ tarefa, darkBg = false, compact = false, onClick }: Props) {
  const stageColor = ESTAGIO_PILL_COLORS[tarefa.estagio || ""] || "bg-muted-foreground/50";
  const cfg = STATUS_ICON_CONFIG[tarefa.status] || STATUS_ICON_CONFIG.pendente;
  const StatusIcon = cfg.completed ? CheckCircle2 : Circle;
  const isCompleted = cfg.completed;

  const isLate = !isCompleted && tarefa.data_prazo
    ? new Date(tarefa.data_prazo + "T23:59:59") < new Date()
    : false;

  return (
    <button
      onClick={onClick}
      title={tarefa.titulo}
      aria-label={`Tarefa: ${tarefa.titulo}${isCompleted ? " (concluída)" : ""}${isLate ? " — atrasada" : ""}`}
      className={cn(
        "group flex items-center gap-1.5 w-full text-left rounded-md transition-all",
        "border border-transparent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        compact ? "px-1 py-0.5" : "px-1.5 py-1",
        darkBg
          ? "hover:bg-white/[0.08] hover:border-white/10 hover:shadow-md"
          : "hover:bg-card hover:border-border/50 hover:shadow-md",
        isCompleted && "opacity-55",
      )}
    >
      {/* Stage dot with subtle glow */}
      <span
        className={cn(
          "shrink-0 rounded-full",
          compact ? "w-1.5 h-1.5" : "w-2 h-2",
          stageColor,
          "shadow-[0_0_4px_currentColor]",
        )}
      />

      {/* Status icon */}
      <StatusIcon className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0", cfg.className)} />

      {/* Title */}
      <span
        className={cn(
          "truncate flex-1 leading-tight",
          compact ? "text-[10px]" : "text-[11px]",
          "font-medium",
          darkBg ? "text-white" : "text-foreground",
          isCompleted && "line-through",
        )}
      >
        {tarefa.titulo}
      </span>

      {/* Late indicator */}
      {isLate && (
        <AlertTriangle className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0 text-destructive")} />
      )}

      {/* Avatar */}
      {tarefa.responsavel && !compact && (
        <Avatar className="h-4 w-4 shrink-0 ring-1 ring-background">
          <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
          <AvatarFallback className="text-[7px]">{tarefa.responsavel.nome?.charAt(0)}</AvatarFallback>
        </Avatar>
      )}
    </button>
  );
}
