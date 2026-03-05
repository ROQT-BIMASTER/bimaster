import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTarefaRisk, RISK_BADGE_STYLES, RiskLevel } from "@/utils/tarefaRiskUtils";

interface TarefaRiskBadgeProps {
  status: string;
  dataPrazo: string | null;
  diasAlertaAntes?: number;
  compact?: boolean;
}

const RISK_ICONS: Record<RiskLevel, React.ReactNode> = {
  overdue: <AlertTriangle className="h-3 w-3" />,
  at_risk: <Clock className="h-3 w-3" />,
  on_track: null,
  completed: <CheckCircle2 className="h-3 w-3" />,
  no_deadline: null,
};

export function TarefaRiskBadge({ status, dataPrazo, diasAlertaAntes = 2, compact = false }: TarefaRiskBadgeProps) {
  const risk = getTarefaRisk(status, dataPrazo, diasAlertaAntes);

  if (risk.level === "no_deadline" || risk.level === "completed") return null;
  if (risk.level === "on_track") return null;

  return (
    <Badge className={cn("text-[9px] px-1.5 py-0 h-4 font-medium border-0 gap-0.5", RISK_BADGE_STYLES[risk.level])}>
      {RISK_ICONS[risk.level]}
      {!compact && <span>{risk.label}</span>}
    </Badge>
  );
}
