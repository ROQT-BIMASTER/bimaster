import { useProjetoTarefas } from "@/hooks/useProjetoTarefas";
import { ProjetoSecao } from "./ProjetoSecao";
import { NovaSecaoInline } from "./NovaSecaoInline";
import { Loader2 } from "lucide-react";

interface ProjetoListViewProps {
  projetoId: string;
}

export function ProjetoListView({ projetoId }: ProjetoListViewProps) {
  const { secoes, tarefasPorSecao, secoesLoading, tarefasLoading, createTarefa, toggleTarefaCompleta, createSecao } = useProjetoTarefas(projetoId);

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

  const handleToggle = (tarefa: any) => {
    toggleTarefaCompleta.mutate(tarefa);
  };

  return (
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

      {/* Sections */}
      {secoes.map(secao => (
        <ProjetoSecao
          key={secao.id}
          nome={secao.nome}
          secaoId={secao.id}
          tarefas={tarefasPorSecao(secao.id)}
          onToggleTarefa={handleToggle}
          onAddTarefa={handleAddTarefa}
        />
      ))}

      <NovaSecaoInline onAdd={(nome) => createSecao.mutate(nome)} />
    </div>
  );
}
