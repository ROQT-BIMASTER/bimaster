import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { subDays, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Activity, Info } from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

type WindowOption = 7 | 14 | 30;
const WINDOW_OPTIONS: WindowOption[] = [7, 14, 30];
const DEFAULT_WINDOW: WindowOption = 14;

export function WidgetTimelineConclusoes({ tarefas }: { tarefas: MinaTarefa[] }) {
  const [windowDays, setWindowDays] = useState<WindowOption>(DEFAULT_WINDOW);

  const { data, total, fallbackCount } = useMemo(() => {
    const now = startOfDay(new Date());
    const counts = new Map<string, number>();
    for (let i = 0; i < windowDays; i++) {
      const d = subDays(now, windowDays - 1 - i);
      counts.set(format(d, "yyyy-MM-dd"), 0);
    }

    let fallbackUsed = 0;

    for (const t of tarefas) {
      if (t.status !== "concluida") continue;

      // Prioriza data_conclusao (campo oficial, mantido pelo trigger).
      // Fallback defensivo para updated_at quando estiver nulo, garantindo
      // que o gráfico não fique vazio em janelas de transição (ex.: importações
      // em massa, restores parciais ou caminhos atípicos que escapem do trigger).
      let referenceDate: Date | null = null;
      if (t.data_conclusao) {
        referenceDate = new Date(t.data_conclusao);
      } else if (t.updated_at) {
        referenceDate = new Date(t.updated_at);
        fallbackUsed++;
      }

      if (!referenceDate || Number.isNaN(referenceDate.getTime())) continue;

      const d = format(startOfDay(referenceDate), "yyyy-MM-dd");
      if (counts.has(d)) counts.set(d, (counts.get(d) || 0) + 1);
    }

    const series = Array.from(counts.entries()).map(([date, value]) => ({
      date: format(new Date(date), "dd/MM", { locale: ptBR }),
      concluidas: value,
    }));

    const totalSum = series.reduce((acc, p) => acc + p.concluidas, 0);
    return { data: series, total: totalSum, fallbackCount: fallbackUsed };
  }, [tarefas]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{total}</span>
          <span>conclusões nos últimos {WINDOW_DAYS} dias</span>
          {fallbackCount > 0 && (
            <span
              className="ml-1 inline-flex items-center rounded-sm bg-warning/15 text-warning px-1.5 py-0.5 text-[10px] font-medium"
              title={`${fallbackCount} tarefa(s) sem data_conclusao registrada — usando última atualização como referência aproximada`}
            >
              ~{fallbackCount} aprox.
            </span>
          )}
        </div>
        <TooltipProvider delayDuration={200}>
          <UITooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground/70 hover:text-foreground transition-colors"
                aria-label="Sobre este gráfico"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[260px] text-xs space-y-1">
              <p>
                Conta tarefas marcadas como concluídas, agrupadas pela data de conclusão.
                A janela cobre os últimos {WINDOW_DAYS} dias corridos.
              </p>
              <p className="text-muted-foreground">
                Quando o campo oficial estiver vazio (transições, importações), usamos a
                data da última atualização como referência aproximada.
              </p>
            </TooltipContent>
          </UITooltip>
        </TooltipProvider>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-8 px-4 rounded-md border border-dashed border-border/60 bg-muted/20">
          <Activity className="h-6 w-6 text-muted-foreground/60 mb-2" />
          <p className="text-xs font-medium text-foreground">
            Sem conclusões registradas nos últimos {WINDOW_DAYS} dias
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-[260px]">
            Quando você marcar uma tarefa como concluída, ela aparece aqui na data correspondente.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="timelineConclusoesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
              width={24}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ fontWeight: 600 }}
              formatter={(v: number) => [v, "Concluídas"]}
            />
            <Area
              type="monotone"
              dataKey="concluidas"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#timelineConclusoesFill)"
              dot={{ r: 2, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
