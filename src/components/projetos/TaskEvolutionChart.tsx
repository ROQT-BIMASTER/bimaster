import { useMemo } from "react";
import { ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO, eachDayOfInterval, startOfDay, min as minDate, max as maxDate, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TarefaMeta } from "@/hooks/useProjetoTarefaMetas";
import { TarefaComentario, TarefaMessage } from "@/hooks/useProjetoTarefaDetalhe";
import { BarChart3 } from "lucide-react";

interface TaskEvolutionChartProps {
  metas: TarefaMeta[];
  comentarios: TarefaComentario[];
  messages: TarefaMessage[];
  subtarefas?: { status: string; created_at?: string }[];
  /** created_at da própria tarefa — usado para iniciar a linha do tempo mesmo sem eventos */
  tarefaCreatedAt?: string;
  accentColor?: string;
}

function safeParse(value?: string | null): Date | null {
  if (!value) return null;
  try {
    const d = parseISO(value);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

export function TaskEvolutionChart({
  metas,
  comentarios,
  messages,
  subtarefas = [],
  tarefaCreatedAt,
  accentColor,
}: TaskEvolutionChartProps) {
  const chartData = useMemo(() => {
    const allDates: Date[] = [];

    metas.forEach(m => {
      const d = safeParse(m.created_at);
      if (d) allDates.push(d);
    });
    comentarios.forEach(c => {
      const d = safeParse(c.created_at);
      if (d) allDates.push(d);
    });
    messages.forEach(m => {
      const d = safeParse(m.created_at);
      if (d) allDates.push(d);
    });
    subtarefas.forEach(s => {
      const d = safeParse(s.created_at);
      if (d) allDates.push(d);
    });

    const tarefaDate = safeParse(tarefaCreatedAt);
    if (tarefaDate) allDates.push(tarefaDate);

    if (allDates.length === 0) return [];

    const start = startOfDay(minDate(allDates));
    const end = startOfDay(maxDate([...allDates, new Date()]));
    const days = eachDayOfInterval({ start, end });

    // Itens "concluíveis" que entram no denominador de progresso
    const concluiveis: { created_at: string; concluido: boolean }[] = [
      ...metas.map(m => ({ created_at: m.created_at, concluido: !!m.concluida })),
      ...subtarefas
        .filter(s => s.created_at)
        .map(s => ({
          created_at: s.created_at as string,
          concluido: s.status === "concluida" || s.status === "concluído" || s.status === "done",
        })),
    ];

    // Concluídos por dia (atribuídos ao created_at — proxy disponível)
    const concluidosPorDia = new Map<string, number>();
    concluiveis
      .filter(i => i.concluido)
      .forEach(i => {
        const d = safeParse(i.created_at);
        if (!d) return;
        const key = format(startOfDay(d), "yyyy-MM-dd");
        concluidosPorDia.set(key, (concluidosPorDia.get(key) || 0) + 1);
      });

    // Atividade por dia: comentários + mensagens + criação de subtarefas/metas
    const atividadePorDia = new Map<string, number>();
    [
      ...comentarios.map(c => c.created_at),
      ...messages.map(m => m.created_at),
      ...metas.map(m => m.created_at),
      ...subtarefas.map(s => s.created_at).filter((v): v is string => !!v),
    ].forEach(raw => {
      const d = safeParse(raw);
      if (!d) return;
      const key = format(startOfDay(d), "yyyy-MM-dd");
      atividadePorDia.set(key, (atividadePorDia.get(key) || 0) + 1);
    });

    const totalConcluiveis = concluiveis.length || 1;
    let acumulado = 0;

    return days.map(day => {
      const key = format(day, "yyyy-MM-dd");
      acumulado += (concluidosPorDia.get(key) || 0);
      return {
        date: format(day, "dd/MM", { locale: ptBR }),
        progresso: Math.min(
          100,
          Math.round((acumulado / totalConcluiveis) * 100),
        ),
        atividade: atividadePorDia.get(key) || 0,
      };
    });
  }, [metas, comentarios, messages, subtarefas, tarefaCreatedAt]);

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
            fill={accentColor ? `${accentColor}26` : "hsl(var(--primary) / 0.15)"}
            stroke={accentColor || "hsl(var(--primary))"}
            strokeWidth={2}
          />
          <Bar
            yAxisId="right"
            dataKey="atividade"
            name="Atividade"
            fill={accentColor ? `${accentColor}66` : "hsl(var(--primary) / 0.4)"}
            radius={[2, 2, 0, 0]}
            maxBarSize={12}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
