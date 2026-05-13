import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertTriangle, CalendarClock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { StageDeadline } from "@/lib/china/timelineSlaCompute";

export type StageStatus = "done" | "pending" | "atrasado" | "neutral";

interface Props {
  icon: LucideIcon;
  title: string;
  status: StageStatus;
  children: React.ReactNode;
  className?: string;
  deadline?: StageDeadline;
}

function DeadlineBadge({ d }: { d: StageDeadline }) {
  if (d.status === "no_sla") return null;
  const dueLabel = d.dueAt ? format(d.dueAt, "dd/MM/yyyy", { locale: ptBR }) : null;
  let label = "";
  let cls = "";
  let Icon = CalendarClock;
  switch (d.status) {
    case "no_prazo":
      label = `Vence ${dueLabel} · ${d.daysRemaining}d restantes`;
      cls = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      break;
    case "perto":
      label = `Vence ${dueLabel} · ${d.daysRemaining}d restantes`;
      cls = "bg-amber-500/15 text-amber-400 border-amber-500/30";
      Icon = Clock;
      break;
    case "atrasado":
      label = `Atrasado ${Math.abs(d.daysRemaining ?? 0)}d (vencia ${dueLabel})`;
      cls = "bg-rose-500/15 text-rose-400 border-rose-500/30";
      Icon = AlertTriangle;
      break;
    case "concluida_no_prazo":
      label = (d.diffDias ?? 0) > 0
        ? `Concluída ${d.diffDias}d antes do prazo`
        : "Concluída no prazo";
      cls = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      Icon = CheckCircle2;
      break;
    case "concluida_atrasada":
      label = `Concluída ${Math.abs(d.diffDias ?? 0)}d após o prazo`;
      cls = "bg-rose-500/15 text-rose-400 border-rose-500/30";
      Icon = AlertTriangle;
      break;
  }
  return (
    <Badge
      variant="outline"
      className={cn("h-4 gap-1 px-1.5 text-[9.5px] font-medium", cls)}
      title={`Prazo da etapa: ${d.diasEtapa}d${dueLabel ? ` · vence ${dueLabel}` : ""}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </Badge>
  );
}

export function StageCard({ icon: Icon, title, status, children, className, deadline }: Props) {
  // Quando há SLA, override do tom só para destacar atraso (não muda a cor "done").
  const effectiveStatus: StageStatus =
    status !== "done" && deadline?.status === "atrasado" ? "atrasado" : status;
  const tone = {
    done: "border-l-emerald-500/60",
    pending: "border-l-amber-500/60",
    atrasado: "border-l-destructive",
    neutral: "border-l-border",
  }[effectiveStatus];
  const StatusIcon = status === "done" ? CheckCircle2 : Clock;
  const statusColor = {
    done: "text-emerald-500",
    pending: "text-amber-500",
    atrasado: "text-destructive",
    neutral: "text-muted-foreground",
  }[effectiveStatus];

  return (
    <Card className={cn("border-l-4 p-3 space-y-2", tone, className)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold flex-1">{title}</h4>
        {deadline && <DeadlineBadge d={deadline} />}
        <StatusIcon className={cn("h-4 w-4", statusColor)} />
      </div>
      <div className="text-xs space-y-1">{children}</div>
    </Card>
  );
}
