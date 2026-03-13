import { useState } from "react";
import { ChevronDown, ChevronRight, ArrowRight, FileSpreadsheet, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { ProjetoTarefaRow, TeamMember } from "./ProjetoTarefaRow";
import { NovaTarefaInline } from "./NovaTarefaInline";
import { BriefingImportDialog } from "./BriefingImportDialog";
import { BriefingView } from "./BriefingView";
import { BriefingToTasksDialog } from "./BriefingToTasksDialog";
import { useProjetoBriefing } from "@/hooks/useProjetoBriefing";
import { GRID_COLS } from "./ProjetoListView";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
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

const SECTION_COLORS = [
  { border: "border-l-blue-500", text: "text-blue-500" },
  { border: "border-l-purple-500", text: "text-purple-500" },
  { border: "border-l-emerald-500", text: "text-emerald-500" },
  { border: "border-l-amber-500", text: "text-amber-500" },
  { border: "border-l-pink-500", text: "text-pink-500" },
  { border: "border-l-cyan-500", text: "text-cyan-500" },
];

interface ProjetoSecaoProps {
  nome: string;
  tarefas: ProjetoTarefa[];
  secaoId: string;
  projetoId: string;
  selectedTarefaId?: string;
  ghosts?: GhostTrail[];
  temBriefing?: boolean;
  allSecoes?: { id: string; nome: string }[];
  secaoIndex?: number;
  onToggleTarefa: (tarefa: ProjetoTarefa) => void;
  onSelectTarefa?: (tarefa: ProjetoTarefa) => void;
  onAddTarefa: (titulo: string, secaoId: string) => void;
  onUpdateTarefa?: (id: string, updates: Record<string, any>) => void;
  onDeleteTarefa?: (tarefaId: string) => void;
  onToggleBriefing?: (secaoId: string, value: boolean) => void;
  onCreateBriefingTasks?: (tasks: { titulo: string; descricao: string; prioridade: string; secao_id: string }[]) => void;
  teamMembers?: TeamMember[];
  onAddColaborador?: (tarefaId: string, userId: string) => void;
  onRemoveColaborador?: (tarefaId: string, userId: string) => void;
  darkBg?: boolean;
}

export function ProjetoSecao({
  nome, tarefas, secaoId, projetoId, selectedTarefaId, ghosts = [], temBriefing = false, allSecoes = [],
  onToggleTarefa, onSelectTarefa, onAddTarefa, onUpdateTarefa, onDeleteTarefa, onToggleBriefing, onCreateBriefingTasks,
  teamMembers, onAddColaborador, onRemoveColaborador, darkBg = false,
}: ProjetoSecaoProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [briefingDialogOpen, setBriefingDialogOpen] = useState(false);
  const [tasksDialogOpen, setTasksDialogOpen] = useState(false);
  const { briefing, saveBriefing, deleteBriefing } = useProjetoBriefing(temBriefing ? secaoId : undefined);

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

  const handleSaveBriefing = (nomeArquivo: string, campos: any[]) => {
    saveBriefing.mutate({ projetoId, secaoId, nomeArquivo, campos });
  };

  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="mb-1">
      <div className={`flex items-center gap-0 px-3 py-2.5 w-full ${darkBg ? "hover:bg-white/5" : "hover:bg-muted/30"}`}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 flex-1 min-w-0 transition-colors group"
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
          {/* Mini progress bar */}
          {totalCount > 0 && (
            <div className={cn("w-16 h-1.5 rounded-full overflow-hidden ml-1", darkBg ? "bg-white/10" : "bg-muted")}>
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBriefing?.(secaoId, !temBriefing);
                }}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  temBriefing
                    ? "text-primary bg-primary/10 hover:bg-primary/20"
                    : darkBg ? "text-white/30 hover:text-white/60 hover:bg-white/5" : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30"
                )}
              >
                <FileSpreadsheet className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{temBriefing ? "Briefing ativo nesta seção" : "Ativar Briefing nesta seção"}</p>
            </TooltipContent>
          </Tooltip>
          {temBriefing && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setBriefingDialogOpen(true);
                  }}
                  className="p-1.5 rounded-md transition-colors text-primary hover:bg-primary/10"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Importar Briefing com IA</p>
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>

      {!collapsed && (
        <div>
          {/* Briefing view when available */}
          {temBriefing && briefing && (
            <BriefingView
              briefing={briefing}
              onDelete={() => deleteBriefing.mutate(briefing.id)}
              onCreateTasks={() => setTasksDialogOpen(true)}
              darkBg={darkBg}
            />
          )}

          {tarefas.map(tarefa => (
            <ProjetoTarefaRow
              key={tarefa.id}
              tarefa={tarefa}
              selected={tarefa.id === selectedTarefaId}
              onToggle={onToggleTarefa}
              onSelect={onSelectTarefa}
              onUpdate={onUpdateTarefa}
              onDelete={onDeleteTarefa}
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
              <div /> {/* separator */}
              <div className={`text-[10px] ${darkBg ? "text-white/40" : "text-muted-foreground"}`}>
                {format(new Date(ghost.created_at), "dd MMM", { locale: ptBR })}
              </div>
              <div />
              <div />
              <div /> {/* separator */}
              <div />
              <div />
              <div /> {/* separator */}
              <div />
              <div />
            </div>
          ))}

          <NovaTarefaInline onAdd={(titulo) => onAddTarefa(titulo, secaoId)} darkBg={darkBg} />
        </div>
      )}

      {temBriefing && (
        <BriefingImportDialog
          open={briefingDialogOpen}
          onOpenChange={setBriefingDialogOpen}
          projetoId={projetoId}
          secaoId={secaoId}
          onSave={handleSaveBriefing}
        />
      )}

      {temBriefing && briefing?.campos && (
        <BriefingToTasksDialog
          open={tasksDialogOpen}
          onOpenChange={setTasksDialogOpen}
          campos={briefing.campos}
          secoes={allSecoes.length > 0 ? allSecoes : [{ id: secaoId, nome }]}
          defaultSecaoId={secaoId}
          onCreateTasks={(tasks) => onCreateBriefingTasks?.(tasks)}
        />
      )}
    </div>
  );
}
