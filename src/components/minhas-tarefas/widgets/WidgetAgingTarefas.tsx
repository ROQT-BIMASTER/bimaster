import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Hourglass } from "lucide-react";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { getToday } from "@/lib/utils/parseLocalDate";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

const BUCKETS = [
  { label: "0-3d",   min: 0,  max: 3,  color: "hsl(var(--success))" },
  { label: "4-7d",   min: 4,  max: 7,  color: "hsl(var(--primary))" },
  { label: "8-14d",  min: 8,  max: 14, color: "hsl(var(--warning))" },
  { label: "15-30d", min: 15, max: 30, color: "hsl(var(--chart-7, var(--warning)))" },
  { label: "30d+",   min: 31, max: Infinity, color: "hsl(var(--destructive))" },
];

export function WidgetAgingTarefas({ tarefas }: { tarefas: MinaTarefa[] }) {
  const { data, total, mediana } = useMemo(() => {
    const now = getToday();
    const counts = BUCKETS.map((b) => ({ ...b, value: 0 }));
    const ages: number[] = [];

    for (const t of tarefas) {
      if (t.status === "concluida") continue;
      if (!t.created_at) continue;
      const age = differenceInCalendarDays(now, startOfDay(new Date(t.created_at)));
      if (age < 0) continue;
      ages.push(age);
      const bucket = counts.find((b) => age >= b.min && age <= b.max);
      if (bucket) bucket.value++;
    }

    const sorted = [...ages].sort((a, b) => a - b);
    const mediana = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

    return {
      data: counts,
      total: ages.length,
      mediana,
    };
  }, [tarefas]);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Hourglass className="h-7 w-7 opacity-40 mb-2" />
        <p className="text-xs">Sem pendências</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground tabular-nums">{total}</span> pendentes
        </span>
        <span>
          Mediana: <span className="font-semibold text-foreground tabular-nums">{mediana}d</span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ left: -16, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            stroke="hsl(var(--border))"
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            stroke="hsl(var(--border))"
            width={24}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
            contentStyle={{
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 12,
              padding: "6px 10px",
            }}
            formatter={(v: number) => [v, "Tarefas"]}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
