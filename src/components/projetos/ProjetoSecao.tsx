import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { ProjetoTarefaRow } from "./ProjetoTarefaRow";
import { NovaTarefaInline } from "./NovaTarefaInline";

interface ProjetoSecaoProps {
  nome: string;
  tarefas: ProjetoTarefa[];
  secaoId: string;
  onToggleTarefa: (tarefa: ProjetoTarefa) => void;
  onAddTarefa: (titulo: string, secaoId: string) => void;
}

export function ProjetoSecao({ nome, tarefas, secaoId, onToggleTarefa, onAddTarefa }: ProjetoSecaoProps) {
  const [collapsed, setCollapsed] = useState(false);
  const completedCount = tarefas.reduce((acc, t) => {
    const sub = t.subtarefas?.filter(s => s.status === "concluida").length || 0;
    return acc + (t.status === "concluida" ? 1 : 0) + sub;
  }, 0);
  const totalCount = tarefas.reduce((acc, t) => acc + 1 + (t.subtarefas?.length || 0), 0);

  return (
    <div className="mb-1">
      {/* Section header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 px-3 py-2.5 w-full hover:bg-muted/30 transition-colors group"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-semibold text-sm text-foreground">{nome}</span>
        <span className="text-xs text-muted-foreground ml-1">
          {completedCount}/{totalCount}
        </span>
      </button>

      {/* Tasks */}
      {!collapsed && (
        <div>
          {tarefas.map(tarefa => (
            <ProjetoTarefaRow
              key={tarefa.id}
              tarefa={tarefa}
              onToggle={onToggleTarefa}
            />
          ))}
          <NovaTarefaInline onAdd={(titulo) => onAddTarefa(titulo, secaoId)} />
        </div>
      )}
    </div>
  );
}
