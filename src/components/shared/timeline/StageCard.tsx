import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StageStatus = "done" | "pending" | "atrasado" | "neutral";

interface Props {
  icon: LucideIcon;
  title: string;
  status: StageStatus;
  children: React.ReactNode;
  className?: string;
}

export function StageCard({ icon: Icon, title, status, children, className }: Props) {
  const tone = {
    done: "border-l-emerald-500/60",
    pending: "border-l-amber-500/60",
    atrasado: "border-l-destructive",
    neutral: "border-l-border",
  }[status];
  const StatusIcon = status === "done" ? CheckCircle2 : Clock;
  const statusColor = {
    done: "text-emerald-500",
    pending: "text-amber-500",
    atrasado: "text-destructive",
    neutral: "text-muted-foreground",
  }[status];

  return (
    <Card className={cn("border-l-4 p-3 space-y-2", tone, className)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold flex-1">{title}</h4>
        <StatusIcon className={cn("h-4 w-4", statusColor)} />
      </div>
      <div className="text-xs space-y-1">{children}</div>
    </Card>
  );
}
