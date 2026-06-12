import { useMemo } from "react";
import { startOfDay, subDays } from "date-fns";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLocalDate, getToday } from "@/lib/utils/parseLocalDate";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

/**
 * Standalone widget rendering taxa de cumprimento como gauge semicircular.
 * Also exported as a KPI variant via the same metrics.
 */
export function WidgetTaxaCumprimentoPrazo({ tarefas }: { tarefas: MinaTarefa[] }) {
  const { rate, sample, delta } = useMemo(() => {
    const now = getToday();
    const cutoff = subDays(now, 30);
    const prev30 = subDays(now, 60);

    let inTime = 0;
    let totalEval = 0;
    let prevInTime = 0;
    let prevTotal = 0;

    for (const t of tarefas) {
      if (t.status !== "concluida") continue;
      if (!t.data_prazo) continue;
      const concluiuRef = t.data_conclusao ? parseLocalDate(t.data_conclusao) : t.updated_at ? new Date(t.updated_at) : null;
      if (!concluiuRef) continue;
      const concluiu = startOfDay(concluiuRef);
      const prazo = startOfDay(parseLocalDate(t.data_prazo)!);
      const onTime = concluiu.getTime() <= prazo.getTime();

      if (concluiu.getTime() >= cutoff.getTime()) {
        totalEval++;
        if (onTime) inTime++;
      } else if (concluiu.getTime() >= prev30.getTime()) {
        prevTotal++;
        if (onTime) prevInTime++;
      }
    }

    const rate = totalEval > 0 ? Math.round((inTime / totalEval) * 100) : null;
    const prevRate = prevTotal > 0 ? Math.round((prevInTime / prevTotal) * 100) : null;
    const delta = rate !== null && prevRate !== null ? rate - prevRate : null;

    return { rate, sample: totalEval, delta };
  }, [tarefas]);

  if (rate === null) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Target className="h-7 w-7 opacity-40 mb-2" />
        <p className="text-xs">Sem dados suficientes (últimos 30d)</p>
      </div>
    );
  }

  // Gauge semicircular: arc length = 180deg
  const radius = 70;
  const stroke = 14;
  const circumference = Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;
  const tone =
    rate >= 80 ? "stroke-success" : rate >= 60 ? "stroke-warning" : "stroke-destructive";
  const toneText =
    rate >= 80 ? "text-success" : rate >= 60 ? "text-warning" : "text-destructive";

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative" style={{ width: radius * 2 + stroke, height: radius + stroke }}>
        <svg
          width={radius * 2 + stroke}
          height={radius + stroke}
          viewBox={`0 0 ${radius * 2 + stroke} ${radius + stroke}`}
        >
          {/* Track */}
          <path
            d={`M ${stroke / 2} ${radius + stroke / 2} A ${radius} ${radius} 0 0 1 ${radius * 2 + stroke / 2} ${radius + stroke / 2}`}
            fill="none"
            className="stroke-muted"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Progress */}
          <path
            d={`M ${stroke / 2} ${radius + stroke / 2} A ${radius} ${radius} 0 0 1 ${radius * 2 + stroke / 2} ${radius + stroke / 2}`}
            fill="none"
            className={cn("transition-all duration-700", tone)}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={cn("text-3xl font-semibold tabular-nums font-display", toneText)}>
            {rate}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
        <span className="tabular-nums">{sample} entregas / 30d</span>
        {delta !== null && delta !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium",
              delta > 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta)}pp
          </span>
        )}
      </div>
    </div>
  );
}

/** Helper exported for use as KPI variant. */
export function calcTaxaPrazo(tarefas: MinaTarefa[]): { rate: number | null; sample: number } {
  const now = getToday();
  const cutoff = subDays(now, 30);
  let inTime = 0;
  let total = 0;
  for (const t of tarefas) {
    if (t.status !== "concluida" || !t.data_prazo) continue;
    const concluiuRef = t.data_conclusao ? parseLocalDate(t.data_conclusao) : t.updated_at ? new Date(t.updated_at) : null;
    if (!concluiuRef) continue;
    const concluiu = startOfDay(concluiuRef);
    if (concluiu.getTime() < cutoff.getTime()) continue;
    total++;
    if (concluiu.getTime() <= startOfDay(parseLocalDate(t.data_prazo)!).getTime()) inTime++;
  }
  return {
    rate: total > 0 ? Math.round((inTime / total) * 100) : null,
    sample: total,
  };
}
