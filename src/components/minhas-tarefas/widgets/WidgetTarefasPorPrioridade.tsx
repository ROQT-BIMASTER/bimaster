import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

const COLORS: Record<string, string> = {
  urgente: "#ef4444",
  alta: "#f97316",
  media: "#3b82f6",
  baixa: "#22c55e",
};
const LABELS: Record<string, string> = {
  urgente: "Urgente",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export function WidgetTarefasPorPrioridade({ tarefas }: { tarefas: MinaTarefa[] }) {
  const data = useMemo(() => {
    const pending = tarefas.filter((t) => t.status !== "concluida");
    const map = new Map<string, number>();
    for (const t of pending) {
      const p = t.prioridade || "media";
      map.set(p, (map.get(p) || 0) + 1);
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
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
