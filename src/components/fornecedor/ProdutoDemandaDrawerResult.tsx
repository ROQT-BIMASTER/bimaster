import { useMemo } from "react";
import { format, addMonths, differenceInCalendarMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { buildForecast, forecastLabel } from "@/lib/forecast";
import {
  useSerieMensalProdutoResult,
  type ProdutoResumoResult,
} from "@/hooks/fornecedor/useVendasProdutoResult";

export type MetricaSerie = "quantidade" | "valor";

interface Props {
  produto: ProdutoResumoResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: MetricaSerie;
  onMetricChange: (m: MetricaSerie) => void;
}

const FORECAST_HORIZON = 6;

function fmtNum(n: number | null | undefined, frac = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

function fmtMonth(d: Date): string {
  return format(d, "MMM/yy", { locale: ptBR });
}

/**
 * Preenche meses faltantes com 0 entre o 1º e o último mês da série.
 * Assume `mes` no formato YYYY-MM-DD (dia 1).
 */
function preencherSerieContinua(
  serie: { mes: string; quantidade: number; valor: number }[],
): { date: Date; mes: string; quantidade: number; valor: number }[] {
  if (!serie || serie.length === 0) return [];
  const parsed = serie
    .map((p) => ({ ...p, date: parseLocalDate(p.mes) }))
    .filter((p): p is typeof p & { date: Date } => p.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (parsed.length === 0) return [];
  const first = parsed[0].date;
  const last = parsed[parsed.length - 1].date;
  const total = differenceInCalendarMonths(last, first) + 1;
  const map = new Map<string, { quantidade: number; valor: number }>();
  parsed.forEach((p) => {
    const key = format(p.date, "yyyy-MM");
    map.set(key, { quantidade: Number(p.quantidade) || 0, valor: Number(p.valor) || 0 });
  });
  const out: { date: Date; mes: string; quantidade: number; valor: number }[] = [];
  for (let i = 0; i < total; i++) {
    const d = addMonths(first, i);
    const key = format(d, "yyyy-MM");
    const hit = map.get(key);
    out.push({
      date: d,
      mes: format(d, "yyyy-MM-dd"),
      quantidade: hit?.quantidade ?? 0,
      valor: hit?.valor ?? 0,
    });
  }
  return out;
}

export function ProdutoDemandaDrawerResult({
  produto,
  open,
  onOpenChange,
  metric,
  onMetricChange,
}: Props) {
  const { data: serieRaw, isLoading } = useSerieMensalProdutoResult(produto?.produto_id ?? null);

  const serieContinua = useMemo(() => preencherSerieContinua(serieRaw ?? []), [serieRaw]);

  const mesesComValor = useMemo(
    () => serieContinua.filter((p) => (metric === "valor" ? p.valor : p.quantidade) > 0).length,
    [serieContinua, metric],
  );
  const historicoCurto = mesesComValor < 6;

  const isCurrency = metric === "valor";

  const chart = useMemo(() => {
    if (serieContinua.length === 0) return null;
    const values = serieContinua.map((p) => (metric === "valor" ? p.valor : p.quantidade));
    const fc = buildForecast(values, FORECAST_HORIZON);

    const histPoints = serieContinua.map((p, i) => ({
      mes: fmtMonth(p.date),
      real: values[i],
      forecast: undefined as number | undefined,
      trend: fc.trend[i],
      lo: undefined as number | undefined,
      hi: undefined as number | undefined,
      band: undefined as [number, number] | undefined,
    }));

    if (historicoCurto) {
      return { points: histPoints, method: fc.method };
    }

    const lastDate = serieContinua[serieContinua.length - 1].date;
    const fcPoints = fc.forecast.map((pt, k) => {
      const d = addMonths(lastDate, k + 1);
      return {
        mes: fmtMonth(d),
        real: undefined,
        forecast: pt.yhat,
        trend: fc.trend[values.length + k],
        lo: pt.lo,
        hi: pt.hi,
        band: [pt.lo, pt.hi] as [number, number],
      };
    });
    return { points: [...histPoints, ...fcPoints], method: fc.method };
  }, [serieContinua, metric, historicoCurto]);

  const dist = useMemo(() => {
    if (serieContinua.length === 0) return null;
    const values = serieContinua.map((p) => (metric === "valor" ? p.valor : p.quantidade));
    const ativos = values.filter((v) => v > 0).length;
    const max = Math.max(...values, 1);
    return { values, ativos, max };
  }, [serieContinua, metric]);

  if (!produto) return null;

  const formatValueAxis = (v: number) =>
    isCurrency
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
      : fmtNum(v);
  const formatTooltip = (v: unknown) => {
    if (typeof v !== "number") return "—";
    return isCurrency ? formatCurrency(v) : fmtNum(v);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">{produto.produto_id}</span>
            <span className="truncate">{produto.descricao ?? "—"}</span>
          </SheetTitle>
          <SheetDescription>
            Demanda mensal · previsão {FORECAST_HORIZON} meses (fonte Result)
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Curva + forecast */}
          <Card className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <div className="text-sm font-medium">
                Demanda mensal + previsão {FORECAST_HORIZON}m
              </div>
              <div className="flex items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={metric}
                  onValueChange={(v) => v && onMetricChange(v as MetricaSerie)}
                  className="border rounded-md"
                  size="sm"
                >
                  <ToggleGroupItem value="quantidade" className="px-3 text-xs">
                    Quantidade
                  </ToggleGroupItem>
                  <ToggleGroupItem value="valor" className="px-3 text-xs">
                    Valor
                  </ToggleGroupItem>
                </ToggleGroup>
                {historicoCurto ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300"
                  >
                    histórico curto
                  </Badge>
                ) : chart ? (
                  <Badge variant="outline" className="text-[10px]">
                    {forecastLabel(chart.method)}
                  </Badge>
                ) : null}
              </div>
            </div>
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : !serieContinua.length ? (
              <div className="h-40 grid place-items-center text-sm text-muted-foreground">
                Sem histórico de vendas.
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chart?.points ?? []} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={formatValueAxis}
                      width={isCurrency ? 80 : 50}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={formatTooltip}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {!historicoCurto && (
                      <Area
                        dataKey="band"
                        stroke="none"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.1}
                        name="Banda 95%"
                        isAnimationActive={false}
                      />
                    )}
                    <Bar dataKey="real" name={isCurrency ? "Faturado" : "Vendido"} fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    {!historicoCurto && (
                      <Bar
                        dataKey="forecast"
                        name="Previsto"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.4}
                        radius={[2, 2, 0, 0]}
                      />
                    )}
                    <Line
                      dataKey="trend"
                      name="Tendência"
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Estatística da demanda */}
          <Card className="p-4">
            <div className="text-sm font-medium mb-3">Estatística da demanda</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Kpi label="Qtd total" value={fmtNum(produto.qtd_total)} />
              <Kpi label="Valor total" value={formatCurrency(Number(produto.valor_total) || 0)} />
              <Kpi label="Média mensal" value={fmtNum(produto.media_mensal)} />
              <Kpi label="Desvio (σ)" value={fmtNum(produto.desvio_mensal)} />
              <Kpi
                label="CV"
                value={
                  produto.cv === null || produto.cv === undefined
                    ? "—"
                    : Number(produto.cv).toLocaleString("pt-BR", { maximumFractionDigits: 2 })
                }
              />
              <Kpi label="Meses ativos" value={fmtNum(produto.meses_ativos)} />
              <Kpi label="Classe ABC" value={produto.classe_abc} />
              <Kpi label="Classe XYZ" value={produto.classe_xyz} />
            </div>

            {dist && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-1">
                  Distribuição mensal ({isCurrency ? "valor" : "quantidade"})
                </div>
                <div className="flex items-end gap-0.5 h-16">
                  {dist.values.map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-primary/70 rounded-sm min-h-[2px]"
                      style={{ height: `${(v / dist.max) * 100}%` }}
                      title={isCurrency ? formatCurrency(v) : `${fmtNum(v)} un`}
                    />
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/50 p-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
    </div>
  );
}
