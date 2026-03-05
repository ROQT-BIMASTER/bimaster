import { useMemo } from "react";
import { getTarefaRisk } from "@/utils/tarefaRiskUtils";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { AlertTriangle, Clock, CheckCircle2, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjetoHealthPanelProps {
  tarefas: ProjetoTarefa[];
  darkBg?: boolean;
}

export function ProjetoHealthPanel({ tarefas, darkBg = false }: ProjetoHealthPanelProps) {
  const stats = useMemo(() => {
    let onTrack = 0, atRisk = 0, overdue = 0, completed = 0, noDeadline = 0;
    for (const t of tarefas) {
      if (t.parent_tarefa_id) continue; // skip subtasks
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

  if (stats.total === 0) return null;

  const items = [
    { icon: CheckCircle2, label: "Concluídas", count: stats.completed, color: "text-emerald-400", bg: darkBg ? "bg-emerald-500/20" : "bg-emerald-500/10" },
    { icon: Target, label: "No prazo", count: stats.onTrack, color: "text-blue-400", bg: darkBg ? "bg-blue-500/20" : "bg-blue-500/10" },
    { icon: Clock, label: "Em risco", count: stats.atRisk, color: "text-amber-400", bg: darkBg ? "bg-amber-500/20" : "bg-amber-500/10" },
    { icon: AlertTriangle, label: "Atrasadas", count: stats.overdue, color: "text-red-400", bg: darkBg ? "bg-red-500/20" : "bg-red-500/10" },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {items.map((item) => (
        item.count > 0 && (
          <div
            key={item.label}
            className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium", item.bg, item.color)}
          >
            <item.icon className="h-3.5 w-3.5" />
            <span>{item.count}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </div>
        )
      ))}
    </div>
  );
}
