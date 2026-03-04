import { useState } from "react";
import { useProjetoTarefas, ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { ProjetoSecao } from "./ProjetoSecao";
import { NovaSecaoInline } from "./NovaSecaoInline";
import { ProjetoTarefaDetalhe } from "./ProjetoTarefaDetalhe";
import { Loader2 } from "lucide-react";

// Grid template matching ProjetoTarefaRow columns
export const GRID_COLS = "grid-cols-[20px_20px_1fr_100px_80px_64px_100px_80px_90px_90px]";

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
    const fullTarefa = tarefas.find(t => t.id === tarefa.id);
    if (fullTarefa) {
      setSelectedTarefa({
        ...fullTarefa,
        subtarefas: tarefas.filter(st => st.parent_tarefa_id === fullTarefa.id),
      });
    } else {
      setSelectedTarefa(tarefa);
    }
  };

  const handleUpdateTarefa = (id: string, updates: Partial<ProjetoTarefa>) => {
    updateTarefa.mutate({ id, ...updates });
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
        <div className={`grid ${GRID_COLS} items-center gap-0 px-3 py-2 border-b border-border/50 bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider`}>
          <div /> {/* expand */}
          <div /> {/* checkbox */}
          <div>Nome da tarefa</div>
          <div>Responsável</div>
          <div>Data con.</div>
          <div>Colab.</div>
          <div>Criador</div>
          <div>Data mod.</div>
          <div className="text-center">Status</div>
          <div className="text-center">Estágio</div>
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
