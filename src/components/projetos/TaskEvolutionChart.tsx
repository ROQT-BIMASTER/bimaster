import { useMemo } from "react";
import { ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO, eachDayOfInterval, startOfDay, min as minDate, max as maxDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TarefaMeta } from "@/hooks/useProjetoTarefaMetas";
import { TarefaComentario, TarefaMessage } from "@/hooks/useProjetoTarefaDetalhe";
import { BarChart3 } from "lucide-react";

interface TaskEvolutionChartProps {
  metas: TarefaMeta[];
  comentarios: TarefaComentario[];
  messages: TarefaMessage[];
  subtarefas?: { status: string; created_at?: string }[];
}

export function TaskEvolutionChart({ metas, comentarios, messages, subtarefas = [] }: TaskEvolutionChartProps) {
  const chartData = useMemo(() => {
    const allDates: Date[] = [];

    metas.forEach(m => allDates.push(parseISO(m.created_at)));
    comentarios.forEach(c => allDates.push(parseISO(c.created_at)));
    messages.forEach(m => allDates.push(parseISO(m.created_at)));

    if (allDates.length === 0) return [];

    const start = startOfDay(minDate(allDates));
    const end = startOfDay(maxDate([...allDates, new Date()]));
    const days = eachDayOfInterval({ start, end });

    // Build cumulative metas completed
    const metasByDay = new Map<string, number>();
    metas.filter(m => m.concluida).forEach(m => {
      const key = format(startOfDay(parseISO(m.created_at)), "yyyy-MM-dd");
      metasByDay.set(key, (metasByDay.get(key) || 0) + 1);
    });

    // Activity per day
    const activityByDay = new Map<string, number>();
    [...comentarios, ...messages].forEach(item => {
      const key = format(startOfDay(parseISO(item.created_at)), "yyyy-MM-dd");
      activityByDay.set(key, (activityByDay.get(key) || 0) + 1);
    });

    let cumulativeMetas = 0;
    const totalMetas = metas.length || 1;

    return days.map(day => {
      const key = format(day, "yyyy-MM-dd");
      cumulativeMetas += (metasByDay.get(key) || 0);
      return {
        date: format(day, "dd/MM", { locale: ptBR }),
        progresso: Math.round((cumulativeMetas / totalMetas) * 100),
        atividade: activityByDay.get(key) || 0,
      };
    });
  }, [metas, comentarios, messages]);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <BarChart3 className="h-8 w-8 mb-2 opacity-40" />
        <p className="text-xs">Sem dados suficientes para o gráfico</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" interval="preserveStartEnd" />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" className="text-muted-foreground" />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} className="text-muted-foreground" hide />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
            labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="progresso"
            name="Progresso (%)"
            fill="hsl(var(--primary) / 0.15)"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
          />
          <Bar
            yAxisId="right"
            dataKey="atividade"
            name="Atividade"
            fill="hsl(var(--primary) / 0.4)"
            radius={[2, 2, 0, 0]}
            maxBarSize={12}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
