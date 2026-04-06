import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
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

  if (data.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">Sem dados</p>;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => [v, "Tarefas"]} />
        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.cor} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
