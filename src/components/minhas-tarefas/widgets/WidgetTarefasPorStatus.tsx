import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Inbox } from "lucide-react";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

const COLORS: Record<string, string> = {
  pendente: "hsl(var(--primary))",
  em_andamento: "hsl(var(--warning))",
  concluida: "hsl(var(--success))",
  bloqueada: "hsl(var(--destructive))",
};
const LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
};
const ORDER = ["pendente", "em_andamento", "bloqueada", "concluida"];

export function WidgetTarefasPorStatus({ tarefas }: { tarefas: MinaTarefa[] }) {
  const { data, total } = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tarefas) {
      map.set(t.status, (map.get(t.status) || 0) + 1);
    }
    const arr = ORDER.filter((k) => map.has(k)).map((k) => ({
      key: k,
      name: LABELS[k] || k,
      value: map.get(k) || 0,
      color: COLORS[k] || "hsl(var(--muted-foreground))",
    }));
    return { data: arr, total: arr.reduce((s, d) => s + d.value, 0) };
  }, [tarefas]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Inbox className="h-7 w-7 opacity-40 mb-2" />
        <p className="text-xs">Sem dados</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={82}
              paddingAngle={2}
              stroke="hsl(var(--background))"
              strokeWidth={2}
            >
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 12,
                padding: "6px 10px",
              }}
              formatter={(v: number, name: string) => [`${v} tarefa${v !== 1 ? "s" : ""}`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-semibold tabular-nums font-display">{total}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
        </div>
      </div>
      <ul className="flex-1 space-y-1.5 text-xs min-w-0">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.key} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-foreground truncate flex-1">{d.name}</span>
              <span className="tabular-nums text-muted-foreground">{d.value}</span>
              <span className="tabular-nums text-muted-foreground/70 w-9 text-right">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
