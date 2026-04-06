import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { subDays, format, startOfDay, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

export function WidgetTimelineConclusoes({ tarefas }: { tarefas: MinaTarefa[] }) {
  const data = useMemo(() => {
    const now = startOfDay(new Date());
    const days = 14;
    const start = subDays(now, days - 1);

    const counts = new Map<string, number>();
    for (let i = 0; i < days; i++) {
      const d = subDays(now, days - 1 - i);
      counts.set(format(d, "yyyy-MM-dd"), 0);
    }

    for (const t of tarefas) {
      if (t.status === "concluida" && t.data_conclusao) {
        const d = format(startOfDay(new Date(t.data_conclusao)), "yyyy-MM-dd");
        if (counts.has(d)) counts.set(d, (counts.get(d) || 0) + 1);
      }
    }

    return Array.from(counts.entries()).map(([date, value]) => ({
      date: format(new Date(date), "dd/MM", { locale: ptBR }),
      concluidas: value,
    }));
  }, [tarefas]);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
        <Tooltip />
        <Line type="monotone" dataKey="concluidas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
