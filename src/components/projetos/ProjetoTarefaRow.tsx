import { useState } from "react";
import { ChevronRight, ChevronDown, Circle, CheckCircle2, Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  em_andamento: "bg-blue-500/20 text-blue-400",
  concluida: "bg-emerald-500/20 text-emerald-400",
  bloqueada: "bg-red-500/20 text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
};

const PRIORIDADE_COLORS: Record<string, string> = {
  alta: "text-red-400",
  media: "text-amber-400",
  baixa: "text-blue-400",
};

interface ProjetoTarefaRowProps {
  tarefa: ProjetoTarefa;
  indented?: boolean;
  onToggle: (tarefa: ProjetoTarefa) => void;
}

export function ProjetoTarefaRow({ tarefa, indented = false, onToggle }: ProjetoTarefaRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSubtarefas = (tarefa.subtarefas?.length || 0) > 0;
  const isCompleted = tarefa.status === "concluida";
  const isOverdue = tarefa.data_prazo && isPast(new Date(tarefa.data_prazo)) && !isCompleted;
  const isDueToday = tarefa.data_prazo && isToday(new Date(tarefa.data_prazo));

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-2 px-3 py-2 border-b border-border/40 hover:bg-muted/30 transition-colors min-h-[44px]",
          indented && "pl-10",
          isCompleted && "opacity-60"
        )}
      >
        {/* Expand toggle for consolidated tasks */}
        <div className="w-5 flex-shrink-0">
          {hasSubtarefas ? (
            <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : null}
        </div>

        {/* Checkbox */}
        <button
          onClick={() => onToggle(tarefa)}
          className={cn(
            "flex-shrink-0 transition-colors",
            isCompleted ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </button>

        {/* Title */}
        <span className={cn(
          "flex-1 text-sm truncate",
          isCompleted && "line-through text-muted-foreground",
          hasSubtarefas && !indented && "font-medium"
        )}>
          {tarefa.titulo}
        </span>

        {/* Subtask count badge */}
        {hasSubtarefas && (
          <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-1 text-muted-foreground border-border/50">
            {tarefa.subtarefas?.filter(s => s.status === "concluida").length}/{tarefa.subtarefas?.length}
          </Badge>
        )}

        {/* Status badge */}
        <Badge className={cn("text-[10px] px-2 py-0 h-5 font-medium border-0", STATUS_COLORS[tarefa.status])}>
          {STATUS_LABELS[tarefa.status] || tarefa.status}
        </Badge>

        {/* Priority indicator */}
        {tarefa.prioridade !== "media" && (
          <span className={cn("text-xs font-medium", PRIORIDADE_COLORS[tarefa.prioridade])}>
            {tarefa.prioridade === "alta" ? "↑ Alta" : "↓ Baixa"}
          </span>
        )}

        {/* Due date */}
        {tarefa.data_prazo && (
          <span className={cn(
            "text-xs flex items-center gap-1 min-w-[80px]",
            isOverdue ? "text-red-400 font-medium" : isDueToday ? "text-amber-400" : "text-muted-foreground"
          )}>
            <Calendar className="h-3 w-3" />
            {format(new Date(tarefa.data_prazo), "dd MMM", { locale: ptBR })}
          </span>
        )}

        {/* Responsavel avatar */}
        {tarefa.responsavel && (
          <Avatar className="h-6 w-6">
            <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
              {tarefa.responsavel.nome?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Collaborators */}
        {tarefa.colaboradores && tarefa.colaboradores.length > 0 && (
          <div className="flex -space-x-1">
            {tarefa.colaboradores.slice(0, 3).map(c => (
              <Avatar key={c.user_id} className="h-5 w-5 border border-background">
                <AvatarImage src={c.avatar_url || undefined} />
                <AvatarFallback className="text-[8px] bg-muted">{c.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            ))}
            {tarefa.colaboradores.length > 3 && (
              <span className="text-[10px] text-muted-foreground ml-1">+{tarefa.colaboradores.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Subtarefas */}
      {expanded && tarefa.subtarefas?.map(st => (
        <ProjetoTarefaRow key={st.id} tarefa={st} indented onToggle={onToggle} />
      ))}
    </>
  );
}
