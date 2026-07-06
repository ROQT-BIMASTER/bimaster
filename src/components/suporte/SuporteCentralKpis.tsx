import { Card } from "@/components/ui/card";
import { MessageSquare, TimerReset, AlertTriangle, ChevronsUp, CheckCircle2 } from "lucide-react";
import type { SuporteChamado } from "@/hooks/suporte/types";

type Tone = "primary" | "destructive" | "warning" | "success";

const TONE: Record<
  Tone,
  {
    bar: string;
    iconBg: string;
    iconFg: string;
    hoverWash: string;
    sparkStroke: string;
    footFg: string;
  }
> = {
  primary: {
    bar: "bg-primary",
    iconBg: "bg-primary/10",
    iconFg: "text-primary",
    hoverWash: "bg-primary/5",
    sparkStroke: "text-primary/30",
    footFg: "text-primary",
  },
  destructive: {
    bar: "bg-destructive",
    iconBg: "bg-destructive/10",
    iconFg: "text-destructive",
    hoverWash: "bg-destructive/5",
    sparkStroke: "text-destructive/30",
    footFg: "text-destructive",
  },
  warning: {
    bar: "bg-amber-500",
    iconBg: "bg-amber-500/10",
    iconFg: "text-amber-600 dark:text-amber-500",
    hoverWash: "bg-amber-500/5",
    sparkStroke: "text-amber-500/30",
    footFg: "text-amber-600 dark:text-amber-500",
  },
  success: {
    bar: "bg-emerald-500",
    iconBg: "bg-emerald-500/10",
    iconFg: "text-emerald-600 dark:text-emerald-500",
    hoverWash: "bg-emerald-500/5",
    sparkStroke: "text-emerald-500/30",
    footFg: "text-emerald-600 dark:text-emerald-500",
  },
};

/** Sparklines pré-definidas por tom (decorativas, mesmo padrão do protótipo). */
const SPARK: Record<Tone, string> = {
  primary: "M0 15C10 12 15 18 25 10C35 2 45 15 60 5",
  destructive: "M0 5C15 8 20 2 35 12C45 18 55 10 60 15",
  warning: "M0 10 L15 10 L30 10 L45 10 L60 10",
  success: "M0 18C15 15 25 5 60 2",
};

function KpiCard({
  icon,
  label,
  value,
  tone,
  footer,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: Tone;
  footer: string;
}) {
  const t = TONE[tone];
  return (
    <Card className="relative group overflow-hidden rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300">
      {/* wash sutil no hover */}
      <div className={`absolute inset-0 ${t.hoverWash} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
      {/* barra vertical semântica */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${t.bar} rounded-l-xl`} />

      <div className="flex justify-between items-start mb-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className={`p-1.5 rounded-lg ${t.iconBg} ${t.iconFg}`}>{icon}</div>
      </div>

      <div className="flex items-end justify-between relative z-10">
        <span className="text-3xl font-bold text-foreground tracking-tight tabular-nums leading-none">
          {value}
        </span>
        <div className="flex flex-col items-end gap-0.5">
          <svg className={`h-6 w-16 ${t.sparkStroke}`} viewBox="0 0 60 20" fill="none">
            <path d={SPARK[tone]} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={`text-[10px] font-medium ${t.footFg}`}>{footer}</span>
        </div>
      </div>
    </Card>
  );
}

function pct(part: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((part / total) * 100)}% do total`;
}

export function SuporteCentralKpis({ tickets }: { tickets: SuporteChamado[] }) {
  const abertos = tickets.filter((t) => t.status !== "resolvido").length;
  const atrasados = tickets.filter((t) => t.sla_status === "violado").length;
  const criticos = tickets.filter((t) => t.prioridade === "critica" && t.status !== "resolvido").length;
  const escalados = tickets.filter((t) => t.status === "escalado").length;
  const resolvidos = tickets.filter((t) => t.status === "resolvido").length;
  const total = tickets.length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KpiCard
        icon={<MessageSquare className="h-4 w-4" strokeWidth={2.5} />}
        label="Abertos"
        value={abertos}
        tone="primary"
        footer={pct(abertos, total)}
      />
      <KpiCard
        icon={<TimerReset className="h-4 w-4" strokeWidth={2.5} />}
        label="Atrasados (SLA)"
        value={atrasados}
        tone="destructive"
        footer={atrasados > 0 ? "Ação urgente" : "Sem violações"}
      />
      <KpiCard
        icon={<AlertTriangle className="h-4 w-4" strokeWidth={2.5} />}
        label="Críticos"
        value={criticos}
        tone="destructive"
        footer={criticos > 0 ? "Prioridade máxima" : "Estável"}
      />
      <KpiCard
        icon={<ChevronsUp className="h-4 w-4" strokeWidth={2.5} />}
        label="Escalados"
        value={escalados}
        tone="warning"
        footer={escalados > 0 ? "Em revisão" : "Padrão"}
      />
      <KpiCard
        icon={<CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />}
        label="Resolvidos"
        value={resolvidos}
        tone="success"
        footer={pct(resolvidos, total)}
      />
    </div>
  );
}
