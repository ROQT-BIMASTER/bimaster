import { useState, useMemo } from "react";
import { useProjetoTarefas, ProjetoTarefa, ProjetoSecao } from "@/hooks/useProjetoTarefas";
import { ProjetoTarefaDetalhe } from "./ProjetoTarefaDetalhe";
import { NovaTarefaInline } from "./NovaTarefaInline";
import { NovaSecaoInline } from "./NovaSecaoInline";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TarefaRiskBadge } from "./TarefaRiskBadge";
import ProductThumbnail from "@/components/fabrica/ProductThumbnail";
import { DisplayGradePopover } from "@/components/fabrica/DisplayGradePopover";
import { cn } from "@/lib/utils";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2, Circle, Calendar, ListChecks, GripVertical, Target,
} from "lucide-react";
import { useMetasProgress, MetasProgress } from "@/hooks/useMetasProgress";
import { Progress } from "@/components/ui/progress";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

const ESTAGIO_ACCENT: Record<string, string> = {
  briefing: "bg-purple-500",
  em_criacao: "bg-blue-500",
  revisao: "bg-amber-500",
  aprovado: "bg-emerald-500",
  producao: "bg-pink-500",
  lancamento: "bg-pink-500",
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
  darkBg?: boolean;
}

/* ───────── Droppable Column ───────── */
function DroppableSecao({ id, children, isOver }: { id: string; children: React.ReactNode; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 transition-all duration-200 min-h-[100px]",
        isOver && "bg-primary/5 ring-2 ring-primary/20 rounded-lg"
      )}
    >
      {children}
    </div>
  );
}

export function ProjetoKanbanView({ projetoId, darkBg = false }: Props) {
  const {
    secoes, tarefas, secoesLoading, tarefasLoading,
    tarefasPorSecao, createTarefa, updateTarefa,
    toggleTarefaCompleta, moveTarefaToSecao, createSecao,
  } = useProjetoTarefas(projetoId);

  const [selectedTarefa, setSelectedTarefa] = useState<ProjetoTarefa | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // Batch-fetch checklist progress for all tasks
  const allTaskIds = useMemo(() => tarefas.map(t => t.id), [tarefas]);
  const metasProgress = useMetasProgress(allTaskIds);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  // Find the tarefa being dragged for the overlay
  const activeTarefa = activeId ? tarefas.find(t => t.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    if (overId && secoes.some(s => s.id === overId)) {
      setOverColumnId(overId);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setOverColumnId(null);

    const overId = event.over?.id as string | null;
    if (!overId || !event.active.id) return;

    const tarefaId = event.active.id as string;
    const tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa) return;

    const targetSecao = secoes.find(s => s.id === overId);
    if (!targetSecao) return;

    if (tarefa.secao_id !== targetSecao.id) {
      moveTarefaToSecao.mutate({
        tarefaId,
        secaoOrigemId: tarefa.secao_id,
        secaoDestinoId: targetSecao.id,
      });
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverColumnId(null);
  };

  if (secoesLoading || tarefasLoading) {
    return (
      <div className={cn("flex items-center justify-center py-20", darkBg ? "text-white/60" : "text-muted-foreground")}>
        Carregando...
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
          {secoes.map((secao) => {
            const secaoTarefas = tarefasPorSecao(secao.id);
            const completedCount = secaoTarefas.filter(t => t.status === "concluida").length;

            return (
              <div
                key={secao.id}
                className={cn(
                  "flex-shrink-0 w-72 rounded-xl border flex flex-col",
                  darkBg ? "bg-white/5 border-white/15" : "bg-muted/30 border-border/50"
                )}
              >
                {/* Column header */}
                <div className={cn("px-3 py-3 border-b", darkBg ? "border-white/10" : "border-border/30")}>
                  <div className="flex items-center justify-between">
                    <h3 className={cn("text-sm font-semibold truncate", darkBg ? "text-white" : "")}>{secao.nome}</h3>
                    <Badge variant="secondary" className={cn("text-[10px] px-1.5 h-5", darkBg && "bg-white/10 text-white/70")}>
                      {completedCount}/{secaoTarefas.length}
                    </Badge>
                  </div>
                </div>

                {/* Cards */}
                <ScrollArea className="flex-1 p-2">
                  <DroppableSecao id={secao.id} isOver={overColumnId === secao.id}>
                    <div className="space-y-2">
                      {secaoTarefas.map((tarefa) => (
                        <DraggableKanbanCard
                          key={tarefa.id}
                          tarefa={tarefa}
                          onSelect={() => setSelectedTarefa(tarefa)}
                          onToggle={() => toggleTarefaCompleta.mutate(tarefa)}
                          darkBg={darkBg}
                          isDragActive={activeId === tarefa.id}
                          metasProgress={metasProgress[tarefa.id]}
                        />
                      ))}
                      {secaoTarefas.length === 0 && (
                        <div className={cn(
                          "text-center py-8 text-xs border-2 border-dashed rounded-lg transition-all",
                          overColumnId === secao.id
                            ? "border-primary/40 bg-primary/5 text-primary"
                            : darkBg ? "border-white/10 text-white/40" : "border-border/30 text-muted-foreground"
                        )}>
                          {overColumnId === secao.id ? "Solte aqui ↓" : "Sem tarefas"}
                        </div>
                      )}
                    </div>
                  </DroppableSecao>
                </ScrollArea>

                {/* Add task */}
                <div className={cn("border-t", darkBg ? "border-white/10" : "border-border/30")}>
                  <NovaTarefaInline
                    onAdd={(titulo) => createTarefa.mutate({ titulo, secao_id: secao.id })}
                    darkBg={darkBg}
                  />
                </div>
              </div>
            );
          })}

          {/* Add column */}
          <div className="flex-shrink-0 w-72">
            <NovaSecaoInline onAdd={(nome) => createSecao.mutate(nome)} darkBg={darkBg} />
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeTarefa ? <OverlayKanbanCard tarefa={activeTarefa} darkBg={darkBg} /> : null}
        </DragOverlay>
      </DndContext>

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

/* ───────── Subtask Popover ───────── */
function SubtarefasPopover({ subtarefas }: { subtarefas: ProjetoTarefa[] }) {
  const completed = subtarefas.filter(s => s.status === "concluida").length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          title="Ver subtarefas"
        >
          <ListChecks className="h-3.5 w-3.5" />
          <span>{completed}/{subtarefas.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-semibold mb-2 text-muted-foreground">Subtarefas</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {subtarefas.map(st => (
            <div key={st.id} className="flex items-center gap-2 text-xs py-1">
              {st.status === "concluida"
                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                : <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              }
              <span className={cn("truncate", st.status === "concluida" && "line-through text-muted-foreground")}>
                {st.titulo}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ───────── Draggable Kanban Card ───────── */
function DraggableKanbanCard({
  tarefa,
  onSelect,
  onToggle,
  darkBg = false,
  isDragActive = false,
  metasProgress,
}: {
  tarefa: ProjetoTarefa;
  onSelect: () => void;
  onToggle: () => void;
  darkBg?: boolean;
  isDragActive?: boolean;
  metasProgress?: MetasProgress;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tarefa.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isCompleted = tarefa.status === "concluida";
  const isOverdue = tarefa.data_prazo && isPast(new Date(tarefa.data_prazo)) && !isCompleted;
  const isDueToday = tarefa.data_prazo && isToday(new Date(tarefa.data_prazo));
  const subtaskCompleted = tarefa.subtarefas?.filter(s => s.status === "concluida").length || 0;
  const subtaskTotal = tarefa.subtarefas?.length || 0;
  const accentColor = tarefa.estagio ? ESTAGIO_ACCENT[tarefa.estagio] : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border transition-all group flex overflow-hidden",
        "hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)] hover:-translate-y-[1px]",
        darkBg
          ? "bg-white/5 border-white/10 hover:border-white/25"
          : "bg-background border-border/60 hover:border-primary/40",
        isCompleted && "opacity-60",
        isDragging && "shadow-xl z-50"
      )}
    >
      {/* Accent bar */}
      {accentColor && <div className={cn("w-1 flex-shrink-0 rounded-l-lg", accentColor)} />}

      <div className="flex-1 p-3">
        {/* Product photo */}
        {tarefa.produto_foto_url && (
          <div className="mb-2 rounded-md overflow-hidden aspect-[16/9] bg-muted">
            <ProductThumbnail src={tarefa.produto_foto_url} alt={tarefa.titulo} size="xl" className="w-full h-full rounded-md" />
          </div>
        )}

        {/* Title row */}
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className={cn(
              "mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none",
              darkBg ? "text-white/30 hover:text-white/60" : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={cn(
              "mt-0.5 flex-shrink-0 transition-colors",
              isCompleted ? "text-emerald-400" : (darkBg ? "text-white/40 hover:text-white" : "text-muted-foreground hover:text-foreground")
            )}
          >
            {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </button>
          <span
            className={cn(
              "text-sm cursor-pointer hover:text-primary transition-colors flex-1",
              darkBg && !isCompleted && "text-white",
              isCompleted && (darkBg ? "line-through text-white/40" : "line-through text-muted-foreground")
            )}
            onClick={onSelect}
          >
            {tarefa.titulo}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {(tarefa as any).codigo_acom && (
            <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">{(tarefa as any).codigo_acom}</span>
          )}
          {tarefa.codigo && (
            <span className={cn("text-[10px] font-mono", darkBg ? "text-white/50" : "text-muted-foreground")}>{tarefa.codigo}</span>
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
          <TarefaRiskBadge
            status={tarefa.status}
            dataPrazo={tarefa.data_prazo}
            diasAlertaAntes={(tarefa as any).dias_alerta_antes ?? 2}
            compact
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center -space-x-1">
            {tarefa.responsavel && (
              <Avatar className={cn("h-5 w-5 border", darkBg ? "border-white/20" : "border-background")}>
                <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
                <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                  {tarefa.responsavel.nome?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            {tarefa.colaboradores?.slice(0, 2).map(c => (
              <Avatar key={c.user_id} className={cn("h-5 w-5 border", darkBg ? "border-white/20" : "border-background")}>
                <AvatarImage src={c.avatar_url || undefined} />
                <AvatarFallback className="text-[8px] bg-muted">{c.nome?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            ))}
        </div>

        {/* Checklist progress bar */}
        {metasProgress && metasProgress.total > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <Target className={cn("h-3 w-3 flex-shrink-0", metasProgress.percent === 100 ? "text-emerald-400" : "text-muted-foreground")} />
            <Progress
              value={metasProgress.percent}
              className={cn("h-1.5 flex-1", darkBg ? "bg-white/10" : "bg-muted")}
            />
            <span className={cn(
              "text-[10px] font-medium flex-shrink-0",
              metasProgress.percent === 100
                ? "text-emerald-400"
                : darkBg ? "text-white/60" : "text-muted-foreground"
            )}>
              {metasProgress.concluidas}/{metasProgress.total}
            </span>
          </div>
        )}
          <div className="flex items-center gap-2">
            {subtaskTotal > 0 && tarefa.subtarefas && (
              <SubtarefasPopover subtarefas={tarefa.subtarefas} />
            )}
            {tarefa.produto_id && (tarefa as any).produto_tipo === "DISPLAY" && (
              <div onClick={(e) => e.stopPropagation()}>
                <DisplayGradePopover
                  produtoId={tarefa.produto_id}
                  produtoNome={tarefa.titulo}
                  produtoCodigo={tarefa.codigo || undefined}
                />
              </div>
            )}
            {tarefa.data_prazo ? (
              <span className={cn(
                "text-[10px] flex items-center gap-1",
                isOverdue ? "text-red-400 font-medium" : isDueToday ? "text-amber-400" : (darkBg ? "text-white/50" : "text-muted-foreground")
              )}>
                <Calendar className="h-3 w-3" />
                {format(new Date(tarefa.data_prazo), "dd MMM", { locale: ptBR })}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Overlay Card (shown while dragging) ───────── */
function OverlayKanbanCard({ tarefa, darkBg = false }: { tarefa: ProjetoTarefa; darkBg?: boolean }) {
  const isCompleted = tarefa.status === "concluida";
  const accentColor = tarefa.estagio ? ESTAGIO_ACCENT[tarefa.estagio] : "";

  return (
    <div
      className={cn(
        "rounded-lg border shadow-2xl rotate-[2deg] scale-105 w-72 flex overflow-hidden",
        darkBg ? "bg-white/10 border-white/20" : "bg-background border-primary/40"
      )}
    >
      {accentColor && <div className={cn("w-1 flex-shrink-0", accentColor)} />}
      <div className="flex-1 p-3">
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground" />
          {isCompleted ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-400" /> : <Circle className="h-4 w-4 mt-0.5 text-muted-foreground" />}
          <span className={cn("text-sm flex-1", darkBg && "text-white", isCompleted && "line-through text-muted-foreground")}>
            {tarefa.titulo}
          </span>
        </div>
        {tarefa.codigo && (
          <span className="text-[10px] font-mono text-muted-foreground ml-10 mt-1 block">{tarefa.codigo}</span>
        )}
      </div>
    </div>
  );
}
