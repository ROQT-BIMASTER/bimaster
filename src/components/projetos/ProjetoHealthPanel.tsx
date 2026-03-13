import { useMemo } from "react";
import { getTarefaRisk } from "@/utils/tarefaRiskUtils";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface ProjetoHealthPanelProps {
  tarefas: ProjetoTarefa[];
  darkBg?: boolean;
}

export function ProjetoHealthPanel({ tarefas, darkBg = false }: ProjetoHealthPanelProps) {
  const stats = useMemo(() => {
    let onTrack = 0, atRisk = 0, overdue = 0, completed = 0, noDeadline = 0;
    for (const t of tarefas) {
      if (t.parent_tarefa_id) continue;
      const risk = getTarefaRisk(t.status, t.data_prazo, (t as any).dias_alerta_antes ?? 2);
      switch (risk.level) {
        case "on_track": onTrack++; break;
        case "at_risk": atRisk++; break;
        case "overdue": overdue++; break;
        case "completed": completed++; break;
        case "no_deadline": noDeadline++; break;
      }
    }
    return { onTrack, atRisk, overdue, completed, noDeadline, total: tarefas.filter(t => !t.parent_tarefa_id).length };
  }, [tarefas]);

  const retrabalhoCount = useMemo(() => {
    return tarefas.filter(t => !t.parent_tarefa_id && (t as any).tipo_tarefa === "retrabalho").length;
  }, [tarefas]);

  if (stats.total === 0) return null;

  const segments = [
    { label: "Concluídas", count: stats.completed, color: "bg-emerald-500", tooltip: `${stats.completed} concluída${stats.completed !== 1 ? "s" : ""}` },
    { label: "No prazo", count: stats.onTrack, color: "bg-blue-500", tooltip: `${stats.onTrack} no prazo` },
    { label: "Em risco", count: stats.atRisk, color: "bg-amber-500", tooltip: `${stats.atRisk} em risco` },
    { label: "Atrasadas", count: stats.overdue, color: "bg-red-500", tooltip: `${stats.overdue} atrasada${stats.overdue !== 1 ? "s" : ""}` },
    { label: "Retrabalho", count: retrabalhoCount, color: "bg-orange-500", tooltip: `${retrabalhoCount} retrabalho` },
  ].filter(s => s.count > 0);

  const activeTotal = segments.reduce((sum, s) => sum + s.count, 0);
  const completedPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3">
        {/* Stacked progress bar */}
        <div className={cn(
          "flex-1 h-2.5 rounded-full overflow-hidden flex",
          darkBg ? "bg-white/10" : "bg-muted"
        )}>
          {segments.map((seg) => (
            <Tooltip key={seg.label}>
              <TooltipTrigger asChild>
                <div
                  className={cn("h-full transition-all duration-500", seg.color)}
                  style={{ width: `${(seg.count / stats.total) * 100}%` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {seg.tooltip}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Percentage label */}
        <span className={cn(
          "text-xs font-semibold tabular-nums whitespace-nowrap",
          darkBg ? "text-white/80" : "text-foreground/70"
        )}>
          {completedPct}% concluído
        </span>

        {/* Legend dots */}
        <div className="flex items-center gap-2">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center gap-1">
              <div className={cn("h-2 w-2 rounded-full", seg.color)} />
              <span className={cn("text-[10px]", darkBg ? "text-white/60" : "text-muted-foreground")}>
                {seg.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
