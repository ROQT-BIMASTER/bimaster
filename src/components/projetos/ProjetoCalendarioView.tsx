import { useState, useMemo, useEffect } from "react";
import { useProjetoTarefas, ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { useTarefaDensity } from "@/hooks/useTarefaDensity";
import { ProjetoFilters, ProjetoSort, EMPTY_FILTERS, DEFAULT_SORT } from "./ProjetoFilterSort";
import { applyProjetoFilters, applyProjetoSort, hasActiveFilters } from "@/lib/projetoFilterUtils";
import { parseLocalDate } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarioAnalisePanel } from "./CalendarioAnalisePanel";
import { UnifiedCalendar } from "@/components/calendario/UnifiedCalendar";
import { tarefaToEvent } from "@/components/calendario/types";
import { CalendarDays, Circle, CheckCircle2, BarChart3 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  ESTAGIO_LABELS, ESTAGIO_PILL_COLORS, STATUS_ICON_CONFIG,
} from "@/lib/projetoConstants";

interface Props {
  projetoId: string;
  darkBg?: boolean;
  filters?: ProjetoFilters;
  sort?: ProjetoSort;
}

export function ProjetoCalendarioView({ projetoId, darkBg = false, filters = EMPTY_FILTERS, sort = DEFAULT_SORT }: Props) {
  const { tarefas: rawTarefas, secoes } = useProjetoTarefas(projetoId);

  const tarefas = useMemo(() => {
    let t: typeof rawTarefas = rawTarefas;
    if (hasActiveFilters(filters)) t = applyProjetoFilters(t, filters) as typeof rawTarefas;
    return applyProjetoSort(t, sort) as typeof rawTarefas;
  }, [rawTarefas, filters, sort]);

  const [filterSecao, setFilterSecao] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedTarefaId, setSelectedTarefaId] = useState<string | null>(null);
  const [showAnalisePanel, setShowAnalisePanel] = useState(false);
  const { isCompact } = useTarefaDensity();

  // Período visível (sincronizado com o UnifiedCalendar via onPeriodChange).
  const [periodoInfo, setPeriodoInfo] = useState(() => {
    const today = getToday();
    return {
      inicio: startOfMonth(today),
      fim: endOfMonth(today),
      label: format(today, "'Mês de' MMMM yyyy", { locale: ptBR }),
    };
  });

  const externalFiltersActive = hasActiveFilters(filters);
  useEffect(() => {
    if (externalFiltersActive) {
      setFilterSecao("all");
      setFilterStatus("all");
    }
  }, [externalFiltersActive]);

  const filteredTarefas = useMemo(() => tarefas.filter((t) => {
    if (!t.data_prazo) return false;
    if (filterSecao !== "all" && t.secao_id !== filterSecao) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  }), [tarefas, filterSecao, filterStatus]);

  const events = useMemo(() => filteredTarefas.map((t) => tarefaToEvent(t)), [filteredTarefas]);

  // Banner de prazos faltando
  const totalParentTasks = tarefas.filter(t => !t.parent_tarefa_id).length;
  const tasksWithoutDeadline = tarefas.filter(t => !t.parent_tarefa_id && !t.data_prazo).length;
  const showDeadlineBanner = totalParentTasks > 0 && (tasksWithoutDeadline / totalParentTasks) > 0.5;

  const banner = showDeadlineBanner ? (
    <div className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs", "bg-warning/10 text-warning")}>
      <CalendarDays className="h-4 w-4 flex-shrink-0" />
      <span>{tasksWithoutDeadline} de {totalParentTasks} tarefas sem prazo — defina prazos para visualizá-las no calendário.</span>
    </div>
  ) : null;

  const leftToolbarExtra = (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-8 text-xs ml-1 gap-1.5", darkBg && "bg-white/10 border-white/20 text-white hover:bg-white/20")}
      onClick={() => setShowAnalisePanel(true)}
    >
      <BarChart3 className="h-3.5 w-3.5" /> Análise
    </Button>
  );

  const rightToolbarExtra = hasActiveFilters(filters) ? (
    <Badge variant="outline" className={cn("text-[10px] h-6 gap-1", darkBg && "border-white/20 text-white/70")}>
      <CalendarDays className="h-3 w-3" /> Filtros ativos via toolbar
    </Badge>
  ) : (
    <>
      <Select value={filterSecao} onValueChange={setFilterSecao}>
        <SelectTrigger className={cn("h-8 w-[140px] text-xs", darkBg && "bg-white/10 border-white/20 text-white")}>
          <SelectValue placeholder="Seção" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas seções</SelectItem>
          {secoes.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>))}
        </SelectContent>
      </Select>
      <Select value={filterStatus} onValueChange={setFilterStatus}>
        <SelectTrigger className={cn("h-8 w-[140px] text-xs", darkBg && "bg-white/10 border-white/20 text-white")}>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos status</SelectItem>
          <SelectItem value="pendente">Não iniciado</SelectItem>
          <SelectItem value="em_andamento">Em andamento</SelectItem>
          <SelectItem value="concluida">Concluído</SelectItem>
          <SelectItem value="bloqueada">Bloqueada</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  if (showAnalisePanel) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className={cn(darkBg && "text-white hover:bg-white/10")} onClick={() => setShowAnalisePanel(false)}>
            ← Voltar ao calendário
          </Button>
          <span className={cn("text-sm font-medium", darkBg ? "text-white/70" : "text-muted-foreground")}>
            {periodoInfo.label}
          </span>
        </div>
        <CalendarioAnalisePanel
          projetoId={projetoId}
          tarefas={tarefas}
          secoes={secoes}
          periodoInicio={periodoInfo.inicio}
          periodoFim={periodoInfo.fim}
          periodoLabel={periodoInfo.label}
          darkBg={darkBg}
          onClose={() => setShowAnalisePanel(false)}
        />
      </div>
    );
  }

  return (
    <>
      <UnifiedCalendar
        events={events}
        onSelectEvent={(ev) => setSelectedTarefaId(ev.id)}
        colorStrategy="estagio"
        compact={isCompact}
        darkBg={darkBg}
        banner={banner}
        leftToolbarExtra={leftToolbarExtra}
        rightToolbarExtra={rightToolbarExtra}
        onPeriodChange={setPeriodoInfo}
      />
      {selectedTarefaId && (
        <TaskDetailPanel
          tarefaId={selectedTarefaId}
          tarefas={tarefas}
          darkBg={darkBg}
          onClose={() => setSelectedTarefaId(null)}
        />
      )}
    </>
  );
}

// ─── Inline detail panel ───
function TaskDetailPanel({ tarefaId, tarefas, darkBg, onClose }: { tarefaId: string; tarefas: ProjetoTarefa[]; darkBg: boolean; onClose: () => void }) {
  const tarefa = tarefas.find((t) => t.id === tarefaId);
  if (!tarefa) return null;

  const cfg2 = STATUS_ICON_CONFIG[tarefa.status] || STATUS_ICON_CONFIG.pendente;
  const StatusIcon = cfg2.completed ? CheckCircle2 : Circle;
  const stageLabel = ESTAGIO_LABELS[tarefa.estagio || ""] || "—";

  return (
    <div className={cn(
      "fixed inset-y-0 right-0 w-80 z-50 shadow-2xl border-l p-5 overflow-y-auto animate-in slide-in-from-right-5",
      darkBg ? "bg-zinc-900 border-white/10 text-white" : "bg-background border-border",
    )}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={cn("font-semibold text-sm", darkBg ? "text-white" : "text-foreground")}>{tarefa.titulo}</h3>
        <Button variant="ghost" size="icon" className={cn("h-7 w-7", darkBg && "text-white hover:bg-white/10")} onClick={onClose}>✕</Button>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn("h-4 w-4", cfg2.className)} />
          <span className={darkBg ? "text-white/70" : "text-muted-foreground"}>
            {tarefa.status === "concluida" ? "Concluído" : tarefa.status === "em_andamento" ? "Em andamento" : tarefa.status === "bloqueada" ? "Bloqueada" : "Não iniciado"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className={cn("h-4 w-4", darkBg ? "text-white/50" : "text-muted-foreground")} />
          <span className={darkBg ? "text-white/70" : "text-muted-foreground"}>
            {tarefa.data_prazo ? format(parseLocalDate(tarefa.data_prazo)!, "dd/MM/yyyy") : "Sem prazo"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", ESTAGIO_PILL_COLORS[tarefa.estagio || ""] || "bg-muted-foreground/50")} />
          <span className={darkBg ? "text-white/70" : "text-muted-foreground"}>{stageLabel}</span>
        </div>
        {tarefa.responsavel && (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
              <AvatarFallback className="text-[8px]">{tarefa.responsavel.nome?.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className={darkBg ? "text-white/70" : "text-muted-foreground"}>{tarefa.responsavel.nome}</span>
          </div>
        )}
        {tarefa.descricao && (
          <p className={cn("text-xs mt-2 whitespace-pre-wrap", darkBg ? "text-white/60" : "text-muted-foreground")}>{tarefa.descricao}</p>
        )}
      </div>
    </div>
  );
}
