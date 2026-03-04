import { useState } from "react";
import { useProjetoTarefas, ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { ProjetoSecao } from "./ProjetoSecao";
import { NovaSecaoInline } from "./NovaSecaoInline";
import { ProjetoTarefaDetalhe } from "./ProjetoTarefaDetalhe";
import { Loader2 } from "lucide-react";

interface ProjetoListViewProps {
  projetoId: string;
}

export function ProjetoListView({ projetoId }: ProjetoListViewProps) {
  const { secoes, tarefas, tarefasPorSecao, secoesLoading, tarefasLoading, createTarefa, updateTarefa, toggleTarefaCompleta, createSecao } = useProjetoTarefas(projetoId);
  const [selectedTarefa, setSelectedTarefa] = useState<ProjetoTarefa | null>(null);

  if (secoesLoading || tarefasLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleAddTarefa = (titulo: string, secaoId: string) => {
    createTarefa.mutate({ titulo, secao_id: secaoId });
  };

  const handleToggle = (tarefa: ProjetoTarefa) => {
    toggleTarefaCompleta.mutate(tarefa);
  };

  const handleSelectTarefa = (tarefa: ProjetoTarefa) => {
    // Find full tarefa with subtarefas from the organized data
    const fullTarefa = tarefas.find(t => t.id === tarefa.id);
    if (fullTarefa) {
      const withSubs = {
        ...fullTarefa,
        subtarefas: tarefas.filter(st => st.parent_tarefa_id === fullTarefa.id),
      };
      setSelectedTarefa(withSubs);
    } else {
      setSelectedTarefa(tarefa);
    }
  };

  const handleUpdateTarefa = (id: string, updates: Partial<ProjetoTarefa>) => {
    updateTarefa.mutate({ id, ...updates });
    // Optimistically update the selected tarefa
    if (selectedTarefa?.id === id) {
      setSelectedTarefa(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleAddSubtarefa = (titulo: string, parentId: string, secaoId: string) => {
    createTarefa.mutate({ titulo, secao_id: secaoId, parent_tarefa_id: parentId });
  };

  return (
    <>
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
        {/* Column headers */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <div className="w-5" />
          <div className="w-5" />
          <div className="flex-1">Nome da tarefa</div>
          <div className="w-16 text-center">Status</div>
          <div className="w-14">Prior.</div>
          <div className="w-20">Prazo</div>
          <div className="w-7">Resp.</div>
          <div className="w-16">Colab.</div>
        </div>

        {secoes.map(secao => (
          <ProjetoSecao
            key={secao.id}
            nome={secao.nome}
            secaoId={secao.id}
            tarefas={tarefasPorSecao(secao.id)}
            selectedTarefaId={selectedTarefa?.id}
            onToggleTarefa={handleToggle}
            onSelectTarefa={handleSelectTarefa}
            onAddTarefa={handleAddTarefa}
          />
        ))}

        <NovaSecaoInline onAdd={(nome) => createSecao.mutate(nome)} />
      </div>

      {/* Task detail side panel */}
      <ProjetoTarefaDetalhe
        tarefa={selectedTarefa}
        open={!!selectedTarefa}
        onOpenChange={(open) => { if (!open) setSelectedTarefa(null); }}
        onUpdate={handleUpdateTarefa}
        onToggle={handleToggle}
        onAddSubtarefa={handleAddSubtarefa}
      />
    </>
  );
}
