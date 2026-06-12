import { useMemo } from "react";
import { subDays, format, startOfDay, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseLocalDate, getToday } from "@/lib/utils/parseLocalDate";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

const WEEKS = 12;
const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function WidgetHeatmapProdutividade({ tarefas }: { tarefas: MinaTarefa[] }) {
  const { weeks, max, total } = useMemo(() => {
    const now = getToday();
    const totalDays = WEEKS * 7;
    // Align grid to end on today (last column = current week)
    const todayDow = getDay(now); // 0 = Sun
    const endOffset = 6 - todayDow; // days to fill after today in last column
    const startDate = subDays(now, totalDays - 1 - endOffset);

    const counts = new Map<string, number>();
    for (const t of tarefas) {
      if (t.status !== "concluida") continue;
      let ref: Date | null = null;
      if (t.data_conclusao) ref = parseLocalDate(t.data_conclusao);
      else if (t.updated_at) ref = new Date(t.updated_at);
      if (!ref || Number.isNaN(ref.getTime())) continue;
      const key = format(startOfDay(ref), "yyyy-MM-dd");
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const cells: { date: Date; key: string; value: number; future: boolean }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = startOfDay(new Date(startDate.getTime() + i * 86400000));
      const key = format(d, "yyyy-MM-dd");
      cells.push({
        date: d,
        key,
        value: counts.get(key) || 0,
        future: d.getTime() > now.getTime(),
      });
    }

    // Re-shape into weeks (columns) × 7 days (rows, Sun=0..Sat=6)
    const weeks: typeof cells[] = [];
    for (let w = 0; w < WEEKS; w++) {
      weeks.push(cells.slice(w * 7, w * 7 + 7));
    }

    const max = cells.reduce((m, c) => Math.max(m, c.value), 0);
    const total = cells.reduce((s, c) => s + c.value, 0);
    return { weeks, max, total };
  }, [tarefas]);

  const intensity = (v: number) => {
    if (v === 0) return 0;
    if (max <= 1) return 4;
    const ratio = v / max;
    if (ratio >= 0.75) return 4;
    if (ratio >= 0.5) return 3;
    if (ratio >= 0.25) return 2;
    return 1;
  };

  const cellClass = (level: number, future: boolean) => {
    if (future) return "bg-muted/30";
    switch (level) {
      case 0: return "bg-muted/60";
      case 1: return "bg-primary/20";
      case 2: return "bg-primary/40";
      case 3: return "bg-primary/65";
      case 4: return "bg-primary";
      default: return "bg-muted";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{total}</span> conclusões nos últimos {WEEKS * 7} dias
        </span>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-[10px]">Menos</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className={cn("h-2.5 w-2.5 rounded-sm", cellClass(l, false))} />
          ))}
          <span className="text-[10px]">Mais</span>
        </div>
      </div>

      <div className="flex gap-1.5">
        <div className="flex flex-col gap-[3px] pt-0 text-[9px] text-muted-foreground">
          {DAY_LABELS.map((l, i) => (
            <div key={i} className="h-[14px] w-3 flex items-center justify-center">
              {i % 2 === 1 ? l : ""}
            </div>
          ))}
        </div>
        <div className="flex gap-[3px] flex-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px] flex-1">
              {week.map((cell, di) => (
                <div
                  key={di}
                  title={`${format(cell.date, "dd/MM/yyyy", { locale: ptBR })} — ${cell.value} conclusão${cell.value !== 1 ? "ões" : ""}`}
                  className={cn(
                    "h-[14px] rounded-[3px] transition-transform hover:scale-110 hover:ring-1 hover:ring-primary",
                    cellClass(intensity(cell.value), cell.future),
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
