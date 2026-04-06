import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

const COLORS: Record<string, string> = {
  pendente: "#3b82f6",
  em_andamento: "#f59e0b",
  concluida: "#22c55e",
  bloqueada: "#ef4444",
};
const LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
};

export function WidgetTarefasPorStatus({ tarefas }: { tarefas: MinaTarefa[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tarefas) {
      map.set(t.status, (map.get(t.status) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({
      name: LABELS[name] || name,
      value,
      color: COLORS[name] || "#6366f1",
    }));
  }, [tarefas]);

  if (data.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
