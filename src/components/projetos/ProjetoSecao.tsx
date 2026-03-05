import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { ProjetoTarefaRow, TeamMember } from "./ProjetoTarefaRow";
import { NovaTarefaInline } from "./NovaTarefaInline";
import { GRID_COLS } from "./ProjetoListView";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GhostTrail {
  tarefa_id: string;
  secao_origem_id: string;
  secao_destino_id: string;
  created_at: string;
  tarefa: ProjetoTarefa;
  destSecaoNome: string;
}

interface ProjetoSecaoProps {
  nome: string;
  tarefas: ProjetoTarefa[];
  secaoId: string;
  selectedTarefaId?: string;
  ghosts?: GhostTrail[];
  onToggleTarefa: (tarefa: ProjetoTarefa) => void;
  onSelectTarefa?: (tarefa: ProjetoTarefa) => void;
  onAddTarefa: (titulo: string, secaoId: string) => void;
  onUpdateTarefa?: (id: string, updates: Record<string, any>) => void;
  teamMembers?: TeamMember[];
  onAddColaborador?: (tarefaId: string, userId: string) => void;
  onRemoveColaborador?: (tarefaId: string, userId: string) => void;
  darkBg?: boolean;
}

export function ProjetoSecao({
  nome, tarefas, secaoId, selectedTarefaId, ghosts = [],
  onToggleTarefa, onSelectTarefa, onAddTarefa, onUpdateTarefa,
  teamMembers, onAddColaborador, onRemoveColaborador, darkBg = false,
}: ProjetoSecaoProps) {
  const [collapsed, setCollapsed] = useState(false);
  const completedCount = tarefas.reduce((acc, t) => {
    const sub = t.subtarefas?.filter(s => s.status === "concluida").length || 0;
    return acc + (t.status === "concluida" ? 1 : 0) + sub;
  }, 0);
  const totalCount = tarefas.reduce((acc, t) => acc + 1 + (t.subtarefas?.length || 0), 0);

  const uniqueGhosts = ghosts.reduce((acc, g) => {
    if (!acc.has(g.tarefa_id)) acc.set(g.tarefa_id, g);
    return acc;
  }, new Map<string, GhostTrail>());
  const ghostList = Array.from(uniqueGhosts.values());

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`flex items-center gap-2 px-3 py-2.5 w-full transition-colors group ${darkBg ? "hover:bg-white/5" : "hover:bg-muted/30"}`}
      >
        {collapsed ? (
          <ChevronRight className={`h-4 w-4 ${darkBg ? "text-white/50" : "text-muted-foreground"}`} />
        ) : (
          <ChevronDown className={`h-4 w-4 ${darkBg ? "text-white/50" : "text-muted-foreground"}`} />
        )}
        <span className={`font-semibold text-sm ${darkBg ? "text-white" : "text-foreground"}`}>{nome}</span>
        <span className={`text-xs ml-1 ${darkBg ? "text-white/60" : "text-foreground/60"}`}>
          {completedCount}/{totalCount}
        </span>
      </button>

      {!collapsed && (
        <div>
          {tarefas.map(tarefa => (
            <ProjetoTarefaRow
              key={tarefa.id}
              tarefa={tarefa}
              selected={tarefa.id === selectedTarefaId}
              onToggle={onToggleTarefa}
              onSelect={onSelectTarefa}
              onUpdate={onUpdateTarefa}
              teamMembers={teamMembers}
              onAddColaborador={onAddColaborador}
              onRemoveColaborador={onRemoveColaborador}
              darkBg={darkBg}
            />
          ))}

          {ghostList.map(ghost => (
            <div
              key={`ghost-${ghost.tarefa_id}`}
              className={`group grid ${GRID_COLS} items-center gap-0 px-3 py-1.5 min-h-[36px] opacity-50 italic ${darkBg ? "border-b border-white/10" : "border-b border-border/20"}`}
            >
              <div />
              <div />
              <div className="flex items-center gap-2 min-w-0 pr-2">
                {ghost.tarefa.codigo && (
                  <span className={`text-[10px] font-mono ${darkBg ? "text-white/40" : "text-muted-foreground"}`}>{ghost.tarefa.codigo}</span>
                )}
                <span className={`text-sm truncate line-through ${darkBg ? "text-white/40" : "text-muted-foreground"}`}>
                  {ghost.tarefa.titulo}
                </span>
                <span className={`flex items-center gap-1 text-[10px] flex-shrink-0 ${darkBg ? "text-white/40" : "text-muted-foreground"}`}>
                  <ArrowRight className="h-3 w-3" />
                  {ghost.destSecaoNome}
                </span>
              </div>
              <div />
              <div className={`text-[10px] ${darkBg ? "text-white/40" : "text-muted-foreground"}`}>
                {format(new Date(ghost.created_at), "dd MMM", { locale: ptBR })}
              </div>
              <div />
              <div />
              <div />
              <div />
              <div />
            </div>
          ))}

          <NovaTarefaInline onAdd={(titulo) => onAddTarefa(titulo, secaoId)} />
        </div>
      )}
    </div>
  );
}
