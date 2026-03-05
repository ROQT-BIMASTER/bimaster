import { differenceInDays, parseISO, startOfDay } from "date-fns";

export type RiskLevel = "on_track" | "at_risk" | "overdue" | "completed" | "no_deadline";

export interface RiskInfo {
  level: RiskLevel;
  daysRemaining: number | null;
  label: string;
}

export function getTarefaRisk(
  status: string,
  dataPrazo: string | null,
  diasAlertaAntes: number = 2
): RiskInfo {
  if (status === "concluida") {
    return { level: "completed", daysRemaining: null, label: "Concluída" };
  }

  if (!dataPrazo) {
    return { level: "no_deadline", daysRemaining: null, label: "Sem prazo" };
  }

  const today = startOfDay(new Date());
  const deadline = startOfDay(parseISO(dataPrazo));
  const daysRemaining = differenceInDays(deadline, today);

  if (daysRemaining < 0) {
    return {
      level: "overdue",
      daysRemaining,
      label: `${Math.abs(daysRemaining)}d atrasada`,
    };
  }

  if (daysRemaining <= diasAlertaAntes) {
    return {
      level: "at_risk",
      daysRemaining,
      label: daysRemaining === 0 ? "Vence hoje" : `${daysRemaining}d restante${daysRemaining > 1 ? "s" : ""}`,
    };
  }

  return {
    level: "on_track",
    daysRemaining,
    label: `${daysRemaining}d restantes`,
  };
}

export const RISK_BADGE_STYLES: Record<RiskLevel, string> = {
  overdue: "bg-red-500/20 text-red-400 animate-pulse",
  at_risk: "bg-amber-500/20 text-amber-400",
  on_track: "bg-emerald-500/20 text-emerald-400",
  completed: "bg-muted text-muted-foreground",
  no_deadline: "",
};
