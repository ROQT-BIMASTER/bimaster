import { cn } from "@/lib/utils";
import type { KpiDef, KpiSeverity } from "./types";

const severityStyles: Record<KpiSeverity, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  primary: "text-primary",
  danger: "text-destructive",
};

export function CadastroKpiStrip({ kpis }: { kpis: KpiDef[] }) {
  if (!kpis.length) return null;

  return (
    <div
      className={cn(
        "px-6 py-4 bg-muted/40 border-b border-border/60 shrink-0",
        "grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4",
      )}
    >
      {kpis.map((kpi, i) => (
        <div
          key={i}
          className="bg-card/60 backdrop-blur-md border border-border/50 p-4 rounded-xl shadow-sm"
        >
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            {kpi.label}
          </span>
          <div
            className={cn(
              "text-2xl font-bold mt-1 tabular-nums leading-tight",
              severityStyles[kpi.severity ?? "default"],
            )}
          >
            {kpi.value}
          </div>
          {kpi.hint && (
            <div className="text-[11px] text-muted-foreground mt-1 truncate">{kpi.hint}</div>
          )}
        </div>
      ))}
    </div>
  );
}
