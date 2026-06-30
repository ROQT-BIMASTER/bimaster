import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { useSerieMensalClienteRubysp } from "@/hooks/fornecedor/useSerieMensalClienteRubysp";
import { buildForecast, forecastLabel } from "@/lib/forecast";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Metric = "faturamento" | "quantidade";

interface Props {
  clienteId: number;
  clienteNome?: string | null;
  horizonMeses?: number;
  className?: string;
  height?: number;
}

function fmtMonthLabel(d: Date) {
  return format(d, "MMM/yy", { locale: ptBR });
}

function formatMetric(value: number, metric: Metric) {
  if (metric === "faturamento") return formatCurrency(value);
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function ClienteHistoricoResultChart({
  clienteId,
  clienteNome,
  horizonMeses = 6,
  className,
  height = 360,
}: Props) {
  const [metric, setMetric] = useState<Metric>("faturamento");
  const { data: serie, isLoading, error } = useSerieMensalClienteRubysp(clienteId);

  const built = useMemo(() => {
    if (!serie || serie.length === 0) return null;
    const values = serie.map((p) => (metric === "faturamento" ? p.faturamento : p.quantidade));
    const nonZero = values.filter((v) => v > 0).length;
    const allowForecast = nonZero >= 6;
    const fc = allowForecast
      ? buildForecast(values, horizonMeses)
      : buildForecast(values, 0); // só tendência, sem horizonte
    const showForecast = allowForecast && fc.method !== "insufficient" && fc.forecast.length > 0;

    const lastDate = serie[serie.length - 1].mes;
    const futureMonths: Date[] = [];
    if (showForecast) {
      for (let i = 1; i <= horizonMeses; i++) {
        futureMonths.push(new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1));
      }
    }

    const rows = serie.map((p, i) => ({
      key: p.mes.toISOString(),
      label: fmtMonthLabel(p.mes),
      real: values[i],
      forecast: null as number | null,
      trend: fc.trend[i] ?? null,
      band: null as [number, number] | null,
      isForecast: false,
    }));
    if (showForecast) {
      fc.forecast.forEach((fp, j) => {
        rows.push({
          key: futureMonths[j].toISOString(),
          label: fmtMonthLabel(futureMonths[j]),
          real: null as any,
          forecast: fp.yhat,
          trend: fc.trend[serie.length + j] ?? null,
          band: [fp.lo, fp.hi],
          isForecast: true,
        });
      });
    }

    const total12 = values.slice(-12).reduce((a, b) => a + b, 0);
    const avgMonth = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const mesesAtivos = nonZero;

    return { rows, fc, total12, avgMonth, mesesAtivos, n: values.length, showForecast };
  }, [serie, metric, horizonMeses]);

  return (
    <Card className={cn("w-full border-0 shadow-none", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Histórico de compras
            </CardTitle>
            {clienteNome && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{clienteNome}</p>
            )}
          </div>
          <div className="inline-flex items-center bg-muted/50 rounded-md border border-border p-0.5">
            <button
              onClick={() => setMetric("faturamento")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-all",
                metric === "faturamento"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Faturamento (R$)
            </button>
            <button
              onClick={() => setMetric("quantidade")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-all",
                metric === "quantidade"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Quantidade
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-0 sm:px-2">
        {isLoading ? (
          <Skeleton className="w-full" style={{ height }} />
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Erro ao carregar histórico"
            description={(error as Error).message}
          />
        ) : !built || built.rows.length === 0 ? (
          <EmptyState
            title="Sem histórico de compra para este cliente"
            description="A série mensal ainda não foi populada (o backfill pode estar em andamento)."
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart data={built.rows} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="bandGradientRuby" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1000
                      ? `${(v / 1000).toFixed(0)}K`
                      : String(Math.round(v))
                  }
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: 12,
                  }}
                  formatter={(value: any, name: string, item: any) => {
                    if (value == null) return ["—", name];
                    if (name === "Intervalo 95%") {
                      const band = item?.payload?.band as [number, number] | null;
                      if (!band) return ["—", name];
                      return [
                        `${formatMetric(band[0], metric)} — ${formatMetric(band[1], metric)}`,
                        name,
                      ];
                    }
                    return [formatMetric(Number(value), metric), name];
                  }}
                  labelFormatter={(label) => label}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />

                {built.showForecast && (
                  <Area
                    dataKey="band"
                    name="Intervalo 95%"
                    type="monotone"
                    fill="url(#bandGradientRuby)"
                    stroke="hsl(var(--primary))"
                    strokeOpacity={0.25}
                    strokeWidth={1}
                    isAnimationActive={false}
                    connectNulls={false}
                    activeDot={false}
                  />
                )}

                <Bar dataKey="real" name="Real" radius={[4, 4, 0, 0]} maxBarSize={42}>
                  {built.rows.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--primary))" />
                  ))}
                </Bar>

                {built.showForecast && (
                  <Bar dataKey="forecast" name="Projeção" radius={[4, 4, 0, 0]} maxBarSize={42}>
                    {built.rows.map((_, i) => (
                      <Cell
                        key={i}
                        fill="hsl(var(--primary))"
                        fillOpacity={0.35}
                        stroke="hsl(var(--primary))"
                        strokeDasharray="3 3"
                        strokeWidth={1}
                      />
                    ))}
                  </Bar>
                )}

                <Line
                  type="monotone"
                  dataKey="trend"
                  name="Tendência"
                  stroke="hsl(var(--foreground))"
                  strokeOpacity={0.7}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Kpi label="Total últimos 12m" value={formatMetric(built.total12, metric)} />
              <Kpi label="Média mensal" value={formatMetric(built.avgMonth, metric)} />
              <Kpi label="Meses ativos" value={`${built.mesesAtivos} / ${built.n}`} />
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-1 px-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-normal text-[11px]">
                  {built.showForecast
                    ? `Previsão: ${forecastLabel(built.fc.method)}`
                    : "Tendência linear (preliminar)"}
                </Badge>
                <Badge variant="outline" className="font-normal text-[11px]">
                  {built.n} meses de histórico
                </Badge>
              </div>
              {!built.showForecast && (
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Histórico curto para projeção (mínimo 6 meses com venda).
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}
