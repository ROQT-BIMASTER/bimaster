import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Inbox } from "lucide-react";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

export function WidgetTarefasPorProjeto({ tarefas }: { tarefas: MinaTarefa[] }) {
  const data = useMemo(() => {
    const map = new Map<string, { nome: string; cor: string; total: number; concluidas: number }>();
    for (const t of tarefas) {
      const cur = map.get(t.projeto_id) || { nome: t.projeto_nome, cor: t.projeto_cor, total: 0, concluidas: 0 };
      cur.total++;
      if (t.status === "concluida") cur.concluidas++;
      map.set(t.projeto_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [tarefas]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Inbox className="h-7 w-7 opacity-40 mb-2" />
        <p className="text-xs">Sem dados</p>
      </div>
    );
  }

  const height = Math.max(180, data.length * 28);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          stroke="hsl(var(--border))"
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="nome"
          width={110}
          tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
          stroke="hsl(var(--border))"
          tickLine={false}
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
        <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={16}>
          {data.map((d, i) => <Cell key={i} fill={d.cor} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
