import { useMemo } from "react";
import { getTarefaRisk } from "@/utils/tarefaRiskUtils";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

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

  // Count open tasks without deadline
  const openWithoutDeadline = useMemo(() => {
    const open = tarefas.filter(t => !t.parent_tarefa_id && t.status !== "concluida");
    return open.filter(t => !t.data_prazo).length;
  }, [tarefas]);
  const openTotal = useMemo(() => tarefas.filter(t => !t.parent_tarefa_id && t.status !== "concluida").length, [tarefas]);
  const showDeadlineWarning = openTotal > 0 && (openWithoutDeadline / openTotal) > 0.5;

  const retrabalhoCount = useMemo(() => {
    return tarefas.filter(t => !t.parent_tarefa_id && (t as any).tipo_tarefa === "retrabalho").length;
  }, [tarefas]);

  if (stats.total === 0) return null;

  const segments = [
    { label: "Concluídas", count: stats.completed, color: "bg-success", icon: CheckCircle2, tooltip: `${stats.completed} concluída${stats.completed !== 1 ? "s" : ""}` },
    { label: "No prazo", count: stats.onTrack, color: "bg-primary", icon: Clock, tooltip: `${stats.onTrack} no prazo` },
    { label: "Em risco", count: stats.atRisk, color: "bg-warning", icon: AlertTriangle, tooltip: `${stats.atRisk} em risco` },
    { label: "Atrasadas", count: stats.overdue, color: "bg-destructive", icon: XCircle, tooltip: `${stats.overdue} atrasada${stats.overdue !== 1 ? "s" : ""}` },
    { label: "Retrabalho", count: retrabalhoCount, color: "bg-orange-500", icon: RefreshCw, tooltip: `${retrabalhoCount} retrabalho` },
  ].filter(s => s.count > 0);

  // Warning segment for tasks without deadline
  const warningSegments = showDeadlineWarning ? [
    { label: "Sem prazo", count: openWithoutDeadline, warning: true },
  ] : [];

  const completedPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <TooltipProvider>
      <div className="space-y-3 animate-fade-in-up">
        {/* KPI chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={cn(
            "text-[11px] gap-1.5 font-medium px-2.5 py-1",
            darkBg ? "bg-white/10 text-white/80 border-white/10" : ""
          )}>
            {stats.total} tarefas
          </Badge>
          {segments.map(seg => {
            const Icon = seg.icon;
            return (
              <Badge
                key={seg.label}
                variant="secondary"
                className={cn(
                  "text-[11px] gap-1.5 font-medium px-2.5 py-1",
                  darkBg ? "bg-white/10 text-white/80 border-white/10" : ""
                )}
              >
                <span className={cn("h-2 w-2 rounded-full inline-block", seg.color)} />
                {seg.count} {seg.label.toLowerCase()}
              </Badge>
            );
          })}
        </div>

        {/* Progress bar + percentage */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex-1 h-1 rounded-full overflow-hidden flex",
            darkBg ? "bg-white/10" : "bg-muted"
          )}>
            {segments.map((seg) => (
              <Tooltip key={seg.label}>
                <TooltipTrigger asChild>
                  <div
                    className={cn("h-full transition-all duration-700 ease-out", seg.color)}
                    style={{ width: `${(seg.count / stats.total) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {seg.tooltip}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          <span className={cn(
            "text-xs font-semibold tabular-nums whitespace-nowrap",
            darkBg ? "text-white/80" : "text-foreground/70"
          )}>
            {completedPct}%
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
