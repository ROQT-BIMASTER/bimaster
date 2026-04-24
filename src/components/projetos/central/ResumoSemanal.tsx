import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Target,
  Activity,
  CalendarRange,
  EyeOff,
} from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  subWeeks,
  isWithinInterval,
  format,
  eachDayOfInterval,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import type { MinaTarefa } from "@/hooks/useMinhasTarefas";

interface Props {
  tarefas: MinaTarefa[];
  loading?: boolean;
  onHide?: () => void;
}

type Trend = "up" | "down" | "flat";

interface MetricDelta {
  current: number;
  previous: number;
  diff: number;        // current - previous
  pctChange: number;   // -100..+∞ (0 if previous is 0 and current is 0)
  trend: Trend;
}

function computeDelta(current: number, previous: number): MetricDelta {
  const diff = current - previous;
  let pctChange = 0;
  if (previous === 0 && current === 0) pctChange = 0;
  else if (previous === 0) pctChange = 100;
  else pctChange = (diff / previous) * 100;

  let trend: Trend = "flat";
  if (diff > 0) trend = "up";
  else if (diff < 0) trend = "down";

  return { current, previous, diff, pctChange, trend };
}

/**
 * Painel de resumo semanal com tendência (semana atual x semana anterior).
 * Mostra evolução de:
 *  - Tarefas concluídas
 *  - Produtividade (% concluídas / planejadas na semana)
 *  - Volume planejado
 *  - Sparkline de conclusões dia-a-dia
 */
export function ResumoSemanal({ tarefas, loading, onHide }: Props) {
  const data = useMemo(() => {
    const now = new Date();
    const curStart = startOfWeek(now, { weekStartsOn: 1 });
    const curEnd = endOfWeek(now, { weekStartsOn: 1 });
    const prevStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const prevEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

    const inRange = (d: Date | null | undefined, s: Date, e: Date) =>
      !!d && isWithinInterval(startOfDay(d), { start: startOfDay(s), end: endOfDay(e) });

    let curConcluidas = 0;
    let prevConcluidas = 0;
    let curPlanejadas = 0;
    let prevPlanejadas = 0;
    let curConcluidasDoPlanejado = 0;
    let prevConcluidasDoPlanejado = 0;

    for (const t of tarefas) {
      const conclusao = t.data_conclusao ? new Date(t.data_conclusao) : null;
      const prazo = t.data_prazo ? new Date(t.data_prazo) : null;

      if (t.status === "concluida" && conclusao) {
        if (inRange(conclusao, curStart, curEnd)) curConcluidas++;
        else if (inRange(conclusao, prevStart, prevEnd)) prevConcluidas++;
      }

      if (prazo) {
        if (inRange(prazo, curStart, curEnd)) {
          curPlanejadas++;
          if (t.status === "concluida") curConcluidasDoPlanejado++;
        } else if (inRange(prazo, prevStart, prevEnd)) {
          prevPlanejadas++;
          if (t.status === "concluida") prevConcluidasDoPlanejado++;
        }
      }
    }

    const curProd =
      curPlanejadas > 0 ? Math.round((curConcluidasDoPlanejado / curPlanejadas) * 100) : 0;
    const prevProd =
      prevPlanejadas > 0 ? Math.round((prevConcluidasDoPlanejado / prevPlanejadas) * 100) : 0;

    // sparkline: conclusões por dia da semana atual e da semana anterior
    const days = eachDayOfInterval({ start: curStart, end: curEnd });
    const sparkline = days.map((d, idx) => {
      const prevDay = eachDayOfInterval({ start: prevStart, end: prevEnd })[idx];
      const curCount = tarefas.filter(
        (t) =>
          t.status === "concluida" &&
          t.data_conclusao &&
          startOfDay(new Date(t.data_conclusao)).getTime() === startOfDay(d).getTime(),
      ).length;
      const prevCount = tarefas.filter(
        (t) =>
          t.status === "concluida" &&
          t.data_conclusao &&
          startOfDay(new Date(t.data_conclusao)).getTime() ===
            startOfDay(prevDay).getTime(),
      ).length;
      return {
        dia: format(d, "EEE", { locale: ptBR }),
        atual: curCount,
        anterior: prevCount,
      };
    });

    return {
      concluidas: computeDelta(curConcluidas, prevConcluidas),
      produtividade: computeDelta(curProd, prevProd),
      planejadas: computeDelta(curPlanejadas, prevPlanejadas),
      sparkline,
      periodLabel: `${format(curStart, "dd/MM", { locale: ptBR })} – ${format(curEnd, "dd/MM", { locale: ptBR })}`,
      prevPeriodLabel: `${format(prevStart, "dd/MM", { locale: ptBR })} – ${format(prevEnd, "dd/MM", { locale: ptBR })}`,
    };
  }, [tarefas]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-48 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-md" />
            ))}
          </div>
          <Skeleton className="h-32 w-full rounded-md mt-4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <CalendarRange className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Resumo da semana</p>
              <p className="text-xs text-muted-foreground">
                {data.periodLabel} · vs semana anterior ({data.prevPeriodLabel})
              </p>
            </div>
          </div>
          {onHide && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={onHide}
              title="Ocultar resumo semanal"
            >
              <EyeOff className="h-3.5 w-3.5" />
              Ocultar
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricBlock
            label="Concluídas"
            icon={CheckCircle2}
            tone="success"
            current={data.concluidas.current}
            previous={data.concluidas.previous}
            pctChange={data.concluidas.pctChange}
            trend={data.concluidas.trend}
            unit=""
            higherIsBetter
          />
          <MetricBlock
            label="Produtividade"
            icon={Target}
            tone="primary"
            current={data.produtividade.current}
            previous={data.produtividade.previous}
            pctChange={data.produtividade.pctChange}
            trend={data.produtividade.trend}
            unit="%"
            higherIsBetter
            progress={data.produtividade.current}
          />
          <MetricBlock
            label="Planejadas"
            icon={Activity}
            tone="muted"
            current={data.planejadas.current}
            previous={data.planejadas.previous}
            pctChange={data.planejadas.pctChange}
            trend={data.planejadas.trend}
            unit=""
          />
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Conclusões por dia — semana atual vs anterior
          </p>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sparkline} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={24} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line
                  type="monotone"
                  dataKey="anterior"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  name="Semana anterior"
                />
                <Line
                  type="monotone"
                  dataKey="atual"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  name="Semana atual"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricBlockProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "primary" | "muted";
  current: number;
  previous: number;
  pctChange: number;
  trend: Trend;
  unit?: string;
  higherIsBetter?: boolean;
  progress?: number; // 0-100, optional progress bar
}

function MetricBlock({
  label,
  icon: Icon,
  tone,
  current,
  previous,
  pctChange,
  trend,
  unit = "",
  higherIsBetter = true,
  progress,
}: MetricBlockProps) {
  const toneStyles = {
    success: { bg: "bg-success/10", text: "text-success" },
    primary: { bg: "bg-primary/10", text: "text-primary" },
    muted: { bg: "bg-muted", text: "text-foreground" },
  }[tone];

  const isImprovement =
    trend === "flat"
      ? null
      : higherIsBetter
        ? trend === "up"
        : trend === "down";

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColor =
    isImprovement === null
      ? "text-muted-foreground"
      : isImprovement
        ? "text-success"
        : "text-destructive";

  const sign = pctChange > 0 ? "+" : pctChange < 0 ? "" : "±";
  const pctLabel =
    previous === 0 && current === 0
      ? "sem dados"
      : `${sign}${Math.abs(pctChange).toFixed(0)}%`;

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("p-1.5 rounded-md shrink-0", toneStyles.bg)}>
            <Icon className={cn("h-3.5 w-3.5", toneStyles.text)} />
          </div>
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
            trendColor,
          )}
        >
          <TrendIcon className="h-3 w-3" />
          {pctLabel}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <p className={cn("text-2xl font-bold tabular-nums", toneStyles.text)}>
          {current}
          {unit}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          ant.: {previous}
          {unit}
        </p>
      </div>
      {typeof progress === "number" && (
        <Progress value={Math.max(0, Math.min(100, progress))} className="h-1.5" />
      )}
    </div>
  );
}
