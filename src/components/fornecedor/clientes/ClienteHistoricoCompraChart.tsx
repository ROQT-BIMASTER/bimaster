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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { useClienteSerieMensal } from "@/hooks/fornecedor/useClienteSerieMensal";
import { forecastSeries, type ForecastMethod } from "@/lib/forecast/holtWinters";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Metric = "faturamento" | "quantidade";

interface Props {
  clienteId: number;
  clienteNome?: string | null;
  desde?: string;
  horizonMeses?: number;
  className?: string;
  /** altura do gráfico em px */
  height?: number;
}

const METHOD_LABEL: Record<ForecastMethod, string> = {
  "holt-winters": "Holt-Winters (sazonalidade 12m)",
  holt: "Holt linear",
  linear: "Regressão linear",
  insufficient: "Histórico insuficiente",
};

function fmtMonthLabel(d: Date) {
  return format(d, "MMM/yy", { locale: ptBR });
}

function formatMetric(value: number, metric: Metric) {
  if (metric === "faturamento") return formatCurrency(value);
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function ClienteHistoricoCompraChart({
  clienteId,
  clienteNome,
  desde = "2024-01-01",
  horizonMeses = 6,
  className,
  height = 360,
}: Props) {
  const [metric, setMetric] = useState<Metric>("faturamento");
  const { data: serie, isLoading, error } = useClienteSerieMensal(clienteId, desde);

  const built = useMemo(() => {
    if (!serie || serie.length === 0) return null;
    const values = serie.map((p) => (metric === "faturamento" ? p.faturamento : p.quantidade));
    const fc = forecastSeries(values, horizonMeses);

    const lastDate = serie[serie.length - 1].mes;
    const futureMonths: Date[] = [];
    for (let i = 1; i <= horizonMeses; i++) {
      futureMonths.push(new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1));
    }

    // Compose chart rows: history then forecast
    const rows = serie.map((p, i) => ({
      key: p.mes.toISOString(),
      label: fmtMonthLabel(p.mes),
      real: values[i],
      forecast: null as number | null,
      trend: fc.trend[i] ?? null,
      band: null as [number, number] | null,
      isForecast: false,
    }));
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

    // KPIs
    const total12 = values.slice(-12).reduce((a, b) => a + b, 0);
    const avgMonth = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    // YoY: último mês completo vs mesmo mês ano anterior
    let yoy: number | null = null;
    if (serie.length >= 13) {
      const lastIdx = serie.length - 1;
      const last = values[lastIdx];
      // procurar mês com mesmo number do mês 12 períodos antes
      const lastMonth = serie[lastIdx].mes;
      const target = new Date(lastMonth.getFullYear() - 1, lastMonth.getMonth(), 1).getTime();
      const prevIdx = serie.findIndex((p) => p.mes.getTime() === target);
      if (prevIdx >= 0 && values[prevIdx] > 0) {
        yoy = (last - values[prevIdx]) / values[prevIdx];
      }
    }

    // CAGR aproximado (entre primeiro e último ponto, anualizado)
    let cagr: number | null = null;
    if (values.length >= 12 && values[0] > 0) {
      const anos = (serie[serie.length - 1].mes.getTime() - serie[0].mes.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (anos > 0) {
        cagr = Math.pow(values[values.length - 1] / values[0], 1 / anos) - 1;
      }
    }

    return { rows, fc, total12, avgMonth, yoy, cagr, n: values.length };
  }, [serie, metric, horizonMeses]);

  return (
    <Card className={cn("w-full", className)}>
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
          <div className="flex items-center gap-2">
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
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
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
            title="Sem histórico no período"
            description="Não há vendas registradas para este cliente desde 2024."
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart data={built.rows} margin={{ top: 10, right: 16, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="bandGradient" x1="0" y1="0" x2="0" y2="1">
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
                    metric === "faturamento"
                      ? v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1000
                        ? `${(v / 1000).toFixed(0)}K`
                        : String(Math.round(v))
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

                {/* Banda de confiança 95% (somente forecast) */}
                <Area
                  dataKey="band"
                  name="Intervalo 95%"
                  type="monotone"
                  fill="url(#bandGradient)"
                  stroke="hsl(var(--primary))"
                  strokeOpacity={0.25}
                  strokeWidth={1}
                  isAnimationActive={false}
                  connectNulls={false}
                  activeDot={false}
                />

                {/* Barras reais */}
                <Bar dataKey="real" name="Real" radius={[4, 4, 0, 0]} maxBarSize={42}>
                  {built.rows.map((r, i) => (
                    <Cell key={i} fill="hsl(var(--primary))" />
                  ))}
                </Bar>

                {/* Barras forecast */}
                <Bar dataKey="forecast" name="Projeção" radius={[4, 4, 0, 0]} maxBarSize={42}>
                  {built.rows.map((r, i) => (
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

                {/* Linha de tendência */}
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

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi
                label="Total últimos 12m"
                value={formatMetric(built.total12, metric)}
              />
              <Kpi
                label="Média mensal"
                value={formatMetric(built.avgMonth, metric)}
              />
              <Kpi
                label="YoY (mês atual)"
                value={
                  built.yoy == null
                    ? "—"
                    : `${(built.yoy * 100).toFixed(1).replace(".", ",")}%`
                }
                tone={built.yoy == null ? "neutral" : built.yoy >= 0 ? "pos" : "neg"}
              />
              <Kpi
                label="CAGR anualizado"
                value={
                  built.cagr == null
                    ? "—"
                    : `${(built.cagr * 100).toFixed(1).replace(".", ",")}%`
                }
                tone={built.cagr == null ? "neutral" : built.cagr >= 0 ? "pos" : "neg"}
              />
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-normal text-[11px]">
                  Método: {METHOD_LABEL[built.fc.method]}
                </Badge>
                <Badge variant="outline" className="font-normal text-[11px]">
                  {built.n} meses de histórico
                </Badge>
              </div>
              {built.fc.method === "insufficient" && (
                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Histórico insuficiente para projeção (mínimo 3 meses).
                </span>
              )}
              {built.fc.method !== "insufficient" && (
                <span className="text-[11px] text-muted-foreground">
                  A faixa sombreada representa o intervalo de confiança 95% — alarga com o horizonte
                  para refletir incerteza crescente.
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Kpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "pos" | "neg";
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-sm font-semibold mt-0.5",
          tone === "pos" && "text-success",
          tone === "neg" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}
