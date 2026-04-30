import { useMemo, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  subWeeks,
  addWeeks,
  isWithinInterval,
  format,
  eachDayOfInterval,
  isSameWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
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
  diff: number;
  pctChange: number;
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
 * Painel de resumo semanal com tendência (semana selecionada x semana anterior).
 *
 * Métricas:
 *  - Concluídas: tarefas com data_conclusao dentro da semana (independente do prazo).
 *    Adiantar tarefas é contabilizado aqui.
 *  - Produtividade: concluídas na semana / (concluídas na semana + pendentes com prazo
 *    até o fim da semana). Adiantar uma tarefa de uma semana futura aumenta o numerador
 *    sem afetar o denominador (ganho de produtividade real).
 *  - Planejadas: tarefas com prazo na semana (carga prevista).
 *  - Sparkline: conclusões por dia (atual vs anterior).
 *
 * Suporta navegação ‹ › entre semanas e botão para voltar à semana corrente.
 */
export function ResumoSemanal({ tarefas, loading, onHide }: Props) {
  // offset 0 = semana atual; -1 = anterior; +1 = próxima.
  const [weekOffset, setWeekOffset] = useState(0);

  const data = useMemo(() => {
    const now = new Date();
    const reference = addWeeks(now, weekOffset);

    const curStart = startOfWeek(reference, { weekStartsOn: 1 });
    const curEnd = endOfWeek(reference, { weekStartsOn: 1 });
    const prevStart = startOfWeek(subWeeks(reference, 1), { weekStartsOn: 1 });
    const prevEnd = endOfWeek(subWeeks(reference, 1), { weekStartsOn: 1 });

    const inRange = (d: Date | null | undefined, s: Date, e: Date) =>
      !!d && isWithinInterval(startOfDay(d), { start: startOfDay(s), end: endOfDay(e) });

    let curConcluidas = 0;
    let prevConcluidas = 0;
    let curPlanejadas = 0;
    let prevPlanejadas = 0;
    let curPendentesAteFim = 0;
    let prevPendentesAteFim = 0;

    for (const t of tarefas) {
      const conclusao = t.data_conclusao ? new Date(t.data_conclusao) : null;
      const prazo = t.data_prazo ? new Date(t.data_prazo) : null;

      // Concluídas conta pela data_conclusao (fonte da verdade do trabalho realizado).
      if (t.status === "concluida" && conclusao) {
        if (inRange(conclusao, curStart, curEnd)) curConcluidas++;
        else if (inRange(conclusao, prevStart, prevEnd)) prevConcluidas++;
      }

      // Planejadas: prazo na semana.
      if (prazo) {
        if (inRange(prazo, curStart, curEnd)) curPlanejadas++;
        else if (inRange(prazo, prevStart, prevEnd)) prevPlanejadas++;
      }

      // Pendentes com prazo até o fim da semana (entram no denominador da produtividade).
      if (t.status !== "concluida" && prazo) {
        const prazoStart = startOfDay(prazo);
        if (prazoStart <= endOfDay(curEnd)) curPendentesAteFim++;
        if (prazoStart <= endOfDay(prevEnd)) prevPendentesAteFim++;
      }
    }

    // Produtividade: concluídas na semana / (concluídas na semana + pendentes ainda com prazo na/antes da semana).
    // Adiantar tarefas eleva o numerador; atrasos elevam o denominador.
    const curDenom = curConcluidas + curPendentesAteFim;
    const prevDenom = prevConcluidas + prevPendentesAteFim;
    const curProd = curDenom > 0 ? Math.round((curConcluidas / curDenom) * 100) : 0;
    const prevProd = prevDenom > 0 ? Math.round((prevConcluidas / prevDenom) * 100) : 0;

    // Sparkline
    const days = eachDayOfInterval({ start: curStart, end: curEnd });
    const prevDays = eachDayOfInterval({ start: prevStart, end: prevEnd });
    const sparkline = days.map((d, idx) => {
      const prevDay = prevDays[idx];
      const dayKey = startOfDay(d).getTime();
      const prevKey = startOfDay(prevDay).getTime();
      let curCount = 0;
      let prevCount = 0;
      for (const t of tarefas) {
        if (t.status !== "concluida" || !t.data_conclusao) continue;
        const k = startOfDay(new Date(t.data_conclusao)).getTime();
        if (k === dayKey) curCount++;
        else if (k === prevKey) prevCount++;
      }
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
      isCurrentWeek: isSameWeek(reference, now, { weekStartsOn: 1 }),
    };
  }, [tarefas, weekOffset]);

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
              <p className="text-sm font-semibold text-foreground">
                {data.isCurrentWeek ? "Resumo da semana" : "Resumo semanal"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.periodLabel} · vs semana anterior ({data.prevPeriodLabel})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset((o) => o - 1)}
              title="Semana anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {!data.isCurrentWeek && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setWeekOffset(0)}
                title="Voltar para a semana atual"
              >
                <RotateCcw className="h-3 w-3" />
                Hoje
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset((o) => o + 1)}
              title="Próxima semana"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            {onHide && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground ml-1"
                onClick={onHide}
                title="Ocultar resumo semanal"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Ocultar
              </Button>
            )}
          </div>
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
            tooltip="Tarefas concluídas dentro da semana selecionada (por data de conclusão)."
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
            tooltip="Concluídas na semana ÷ (concluídas + pendentes com prazo até o fim da semana). Adiantar tarefas eleva esta métrica."
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
            tooltip="Tarefas com prazo dentro da semana (carga prevista)."
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
  progress?: number;
  tooltip?: string;
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
  tooltip,
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
    <div
      className="rounded-lg border border-border/60 p-3 space-y-2 bg-card"
      title={tooltip}
    >
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
