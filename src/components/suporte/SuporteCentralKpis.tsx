import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, TimerReset, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import type { SuporteChamado } from "@/hooks/suporte/types";

type Tone = "primary" | "destructive" | "warning" | "success";

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: Tone;
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary border-l-primary",
    destructive: "bg-destructive/10 text-destructive border-l-destructive",
    warning: "bg-amber-500/10 text-amber-700 border-l-amber-500",
    success: "bg-emerald-500/10 text-emerald-700 border-l-emerald-500",
  }[tone];
  const [bg, fg, border] = toneClass.split(" ");
  return (
    <Card className={`border-l-4 ${border}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bg} ${fg}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground truncate">{label}</div>
          <div className="text-2xl font-semibold tabular-nums leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SuporteCentralKpis({ tickets }: { tickets: SuporteChamado[] }) {
  const abertos = tickets.filter((t) => t.status !== "resolvido").length;
  const atrasados = tickets.filter((t) => t.sla_status === "violado").length;
  const criticos = tickets.filter((t) => t.prioridade === "critica" && t.status !== "resolvido").length;
  const escalados = tickets.filter((t) => t.status === "escalado").length;
  const resolvidos = tickets.filter((t) => t.status === "resolvido").length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KpiCard icon={<MessageSquare className="h-4 w-4" />} label="Abertos" value={abertos} tone="primary" />
      <KpiCard icon={<TimerReset className="h-4 w-4" />} label="Atrasados (SLA)" value={atrasados} tone="destructive" />
      <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Críticos" value={criticos} tone="destructive" />
      <KpiCard icon={<Clock className="h-4 w-4" />} label="Escalados" value={escalados} tone="warning" />
      <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Resolvidos" value={resolvidos} tone="success" />
    </div>
  );
}
