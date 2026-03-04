import { useState } from "react";
import { useProjetoTarefas, ProjetoTarefa, ProjetoSecao } from "@/hooks/useProjetoTarefas";
import { ProjetoTarefaDetalhe } from "./ProjetoTarefaDetalhe";
import { NovaTarefaInline } from "./NovaTarefaInline";
import { NovaSecaoInline } from "./NovaSecaoInline";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2, Circle, Calendar, GripVertical, Plus,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  nao_iniciado: "bg-pink-500/20 text-pink-400",
  em_andamento: "bg-amber-500/20 text-amber-400",
  concluida: "bg-emerald-500/20 text-emerald-400",
  bloqueada: "bg-red-500/20 text-red-400",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Não iniciado",
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluida: "Concluído",
  bloqueada: "Bloqueada",
};

const ESTAGIO_COLORS: Record<string, string> = {
  briefing: "bg-purple-500/20 text-purple-400",
  em_criacao: "bg-blue-500/20 text-blue-400",
  revisao: "bg-amber-500/20 text-amber-400",
  aprovado: "bg-emerald-500/20 text-emerald-400",
  producao: "bg-pink-500/20 text-pink-400",
  lancamento: "bg-pink-500/20 text-pink-400",
};

const ESTAGIO_LABELS: Record<string, string> = {
  briefing: "Briefing",
  em_criacao: "Em Criação",
  revisao: "Revisão",
  aprovado: "Aprovado",
  producao: "Produção",
  lancamento: "Lançamento",
};

interface Props {
  projetoId: string;
}

export function ProjetoKanbanView({ projetoId }: Props) {
  const {
    secoes, tarefas, secoesLoading, tarefasLoading,
    tarefasPorSecao, createTarefa, updateTarefa,
    toggleTarefaCompleta, moveTarefaToSecao, createSecao,
  } = useProjetoTarefas(projetoId);

  const [selectedTarefa, setSelectedTarefa] = useState<ProjetoTarefa | null>(null);

  const handleDragStart = (e: React.DragEvent, tarefa: ProjetoTarefa) => {
    e.dataTransfer.setData("tarefaId", tarefa.id);
    e.dataTransfer.setData("secaoOrigemId", tarefa.secao_id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, secaoDestinoId: string) => {
    e.preventDefault();
    const tarefaId = e.dataTransfer.getData("tarefaId");
    const secaoOrigemId = e.dataTransfer.getData("secaoOrigemId");
    if (tarefaId && secaoOrigemId && secaoOrigemId !== secaoDestinoId) {
      moveTarefaToSecao.mutate({ tarefaId, secaoOrigemId, secaoDestinoId });
    }
  };

  if (secoesLoading || tarefasLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
        {secoes.map((secao) => {
          const secaoTarefas = tarefasPorSecao(secao.id);
          const completedCount = secaoTarefas.filter(t => t.status === "concluida").length;

          return (
            <div
              key={secao.id}
              className="flex-shrink-0 w-72 bg-muted/30 rounded-xl border border-border/50 flex flex-col"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, secao.id)}
            >
              {/* Column header */}
              <div className="px-3 py-3 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold truncate">{secao.nome}</h3>
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                    {completedCount}/{secaoTarefas.length}
                  </Badge>
                </div>
              </div>

              {/* Cards */}
              <ScrollArea className="flex-1 p-2">
                <div className="space-y-2">
                  {secaoTarefas.map((tarefa) => (
                    <KanbanCard
                      key={tarefa.id}
                      tarefa={tarefa}
                      onSelect={() => setSelectedTarefa(tarefa)}
                      onToggle={() => toggleTarefaCompleta.mutate(tarefa)}
                      onDragStart={(e) => handleDragStart(e, tarefa)}
                    />
                  ))}
                </div>
              </ScrollArea>

              {/* Add task */}
              <div className="border-t border-border/30">
                <NovaTarefaInline
                  onAdd={(titulo) => createTarefa.mutate({ titulo, secao_id: secao.id })}
                />
              </div>
            </div>
          );
        })}

        {/* Add column */}
        <div className="flex-shrink-0 w-72">
          <NovaSecaoInline onAdd={(nome) => createSecao.mutate(nome)} />
        </div>
      </div>

      {/* Task detail sheet */}
      <ProjetoTarefaDetalhe
        tarefa={selectedTarefa}
        open={!!selectedTarefa}
        onOpenChange={(open) => { if (!open) setSelectedTarefa(null); }}
        onUpdate={(id, updates) => updateTarefa.mutate({ id, ...updates })}
        onToggle={(t) => toggleTarefaCompleta.mutate(t)}
        onAddSubtarefa={(titulo, parentId, secaoId) => createTarefa.mutate({ titulo, secao_id: secaoId, parent_tarefa_id: parentId })}
        secoes={secoes}
        onMoveTarefa={(tarefaId, secaoOrigemId, secaoDestinoId) => moveTarefaToSecao.mutate({ tarefaId, secaoOrigemId, secaoDestinoId })}
      />
    </>
  );
}

function KanbanCard({
  tarefa,
  onSelect,
  onToggle,
  onDragStart,
}: {
  tarefa: ProjetoTarefa;
  onSelect: () => void;
  onToggle: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const isCompleted = tarefa.status === "concluida";
  const isOverdue = tarefa.data_prazo && isPast(new Date(tarefa.data_prazo)) && !isCompleted;
  const isDueToday = tarefa.data_prazo && isToday(new Date(tarefa.data_prazo));
  const subtaskCompleted = tarefa.subtarefas?.filter(s => s.status === "concluida").length || 0;
  const subtaskTotal = tarefa.subtarefas?.length || 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        "bg-background rounded-lg border border-border/60 p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-sm transition-all group",
        isCompleted && "opacity-60"
      )}
    >
      {/* Product photo */}
      {tarefa.produto_foto_url && (
        <div className="mb-2 rounded-md overflow-hidden aspect-[16/9] bg-muted">
          <ProductThumbnail src={tarefa.produto_foto_url} alt={tarefa.titulo} size="xl" className="w-full h-full rounded-md" />
        </div>
      )}

      {/* Title row */}
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={cn(
            "mt-0.5 flex-shrink-0 transition-colors",
            isCompleted ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
        </button>
        <span
          className={cn(
            "text-sm cursor-pointer hover:text-primary transition-colors flex-1",
            isCompleted && "line-through text-muted-foreground"
          )}
          onClick={onSelect}
        >
          {tarefa.titulo}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {tarefa.codigo && (
          <span className="text-[10px] text-muted-foreground font-mono">{tarefa.codigo}</span>
        )}
        {tarefa.estagio && ESTAGIO_LABELS[tarefa.estagio] && (
          <Badge className={cn("text-[9px] px-1.5 py-0 h-4 font-medium border-0", ESTAGIO_COLORS[tarefa.estagio])}>
            {ESTAGIO_LABELS[tarefa.estagio]}
          </Badge>
        )}
        {tarefa.status && tarefa.status !== "pendente" && (
          <Badge className={cn("text-[9px] px-1.5 py-0 h-4 font-medium border-0", STATUS_COLORS[tarefa.status])}>
            {STATUS_LABELS[tarefa.status] || tarefa.status}
          </Badge>
        )}
        {subtaskTotal > 0 && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5">
            {subtaskCompleted}/{subtaskTotal}
          </Badge>
        )}
      </div>

      {/* Footer: date + avatar */}
      <div className="flex items-center justify-between mt-2.5">
        {tarefa.data_prazo ? (
          <span className={cn(
            "text-[10px] flex items-center gap-1",
            isOverdue ? "text-red-400 font-medium" : isDueToday ? "text-amber-400" : "text-muted-foreground"
          )}>
            <Calendar className="h-3 w-3" />
            {format(new Date(tarefa.data_prazo), "dd MMM", { locale: ptBR })}
          </span>
        ) : <span />}

        <div className="flex items-center -space-x-1">
          {tarefa.responsavel && (
            <Avatar className="h-5 w-5 border border-background">
              <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
              <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                {tarefa.responsavel.nome?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          {tarefa.colaboradores?.slice(0, 2).map(c => (
            <Avatar key={c.user_id} className="h-5 w-5 border border-background">
              <AvatarImage src={c.avatar_url || undefined} />
              <AvatarFallback className="text-[8px] bg-muted">{c.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          ))}
        </div>
      </div>
    </div>
  );
}