import { useMemo } from "react";
import { startOfDay, endOfWeek, startOfWeek, addWeeks, addDays, isWithinInterval } from "date-fns";
import { Layers } from "lucide-react";
import { parseLocalDate, getToday } from "@/lib/utils/parseLocalDate";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface Bucket {
  label: string;
  total: number;
  atrasadas: number;
  semPrazo: number;
}

export function WidgetCargaCapacidade({ tarefas }: { tarefas: MinaTarefa[] }) {
  const buckets = useMemo<Bucket[]>(() => {
    const now = getToday();
    const todayEnd = addDays(now, 1);
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const nextWeekStart = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });

    const b: Bucket[] = [
      { label: "Hoje", total: 0, atrasadas: 0, semPrazo: 0 },
      { label: "Esta semana", total: 0, atrasadas: 0, semPrazo: 0 },
      { label: "Próxima semana", total: 0, atrasadas: 0, semPrazo: 0 },
      { label: "Sem prazo", total: 0, atrasadas: 0, semPrazo: 0 },
    ];

    for (const t of tarefas) {
      if (t.status === "concluida") continue;
      const prazo = parseLocalDate(t.data_prazo);

      if (!prazo) {
        b[3].total++;
        b[3].semPrazo++;
        continue;
      }
      const p = startOfDay(prazo);

      if (p.getTime() < now.getTime()) {
        // Atrasada → conta em "Hoje" como atrasada (precisa atenção hoje)
        b[0].total++;
        b[0].atrasadas++;
      } else if (p.getTime() < todayEnd.getTime()) {
        b[0].total++;
      } else if (isWithinInterval(p, { start: now, end: thisWeekEnd })) {
        b[1].total++;
      } else if (isWithinInterval(p, { start: nextWeekStart, end: nextWeekEnd })) {
        b[2].total++;
      }
    }
    return b;
  }, [tarefas]);

  const max = Math.max(1, ...buckets.map((b) => b.total));
  const totalAll = buckets.reduce((s, b) => s + b.total, 0);

  if (totalAll === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Layers className="h-7 w-7 opacity-40 mb-2" />
        <p className="text-xs">Sem tarefas pendentes</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {buckets.map((b) => {
        const pct = (b.total / max) * 100;
        const atrasadasPct = b.total > 0 ? (b.atrasadas / b.total) * 100 : 0;
        return (
          <li key={b.label} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-foreground font-medium">{b.label}</span>
              <span className="text-muted-foreground tabular-nums">
                <span className="text-foreground font-semibold">{b.total}</span>
                {b.atrasadas > 0 && (
                  <span className="ml-1.5 text-destructive">({b.atrasadas} atrasadas)</span>
                )}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-primary/70 rounded-full transition-all"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
              {atrasadasPct > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-destructive rounded-full transition-all"
                  style={{ width: `${Math.max(2, (pct * atrasadasPct) / 100)}%` }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
