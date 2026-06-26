import { useMemo } from "react";
import { format, addMonths } from "date-fns";
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
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import {
  coberturaDias,
  dataRuptura,
  diasAteRuptura,
  estoqueSeguranca,
  giroAnual,
  pontoReposicao,
  quantidadeRepor,
  statusEstoque,
  zFromServico,
} from "@/lib/inventory";
import { buildForecast, forecastLabel } from "@/lib/forecast";
import {
  useSerieMensalProduto,
  type ProdutoResumo,
} from "@/hooks/fornecedor/useVendasProduto";

interface Props {
  produto: ProdutoResumo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadDias: number;
  servico: 90 | 95 | 98;
}

function fmtNum(n: number | null | undefined, frac = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: frac, maximumFractionDigits: frac });
}

function fmtMonth(d: Date): string {
  return format(d, "MMM/yy", { locale: ptBR });
}

const FORECAST_HORIZON = 6;

export function ProdutoDemandaDrawer({ produto, open, onOpenChange, leadDias, servico }: Props) {
  const { data: serie, isLoading } = useSerieMensalProduto(produto?.cod_produto ?? null);

  const chartData = useMemo(() => {
    if (!serie || serie.length === 0) return [];
    const values = serie.map((p) => Number(p.quantidade) || 0);
    const fc = buildForecast(values, FORECAST_HORIZON);

    const histPoints = serie.map((p, i) => {
      const d = parseLocalDate(p.mes);
      return {
        mes: d ? fmtMonth(d) : p.mes,
        real: values[i],
        forecast: undefined as number | undefined,
        trend: fc.trend[i],
        lo: undefined as number | undefined,
        hi: undefined as number | undefined,
        band: undefined as [number, number] | undefined,
      };
    });

    const lastDate = parseLocalDate(serie[serie.length - 1].mes) ?? new Date();
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
  }, [serie]);

  const dist = useMemo(() => {
    if (!serie || serie.length === 0) return null;
    const values = serie.map((p) => Number(p.quantidade) || 0);
    const ativos = values.filter((v) => v > 0).length;
    const max = Math.max(...values, 1);
    return { values, ativos, max };
  }, [serie]);

  if (!produto) return null;

  const z = zFromServico(servico);
  const media = Number(produto.media_mensal) || 0;
  const desvio = Number(produto.desvio_mensal) || 0;
  const estoque = Number(produto.estoque_atual) || 0;
  const cob = coberturaDias(estoque, media);
  const es = estoqueSeguranca(desvio, leadDias, z);
  const rop = pontoReposicao(media, desvio, leadDias, z);
  const giro = giroAnual(media, estoque);
  const dRup = diasAteRuptura(estoque, media);
  const dataRup = dataRuptura(estoque, media);
  const status = statusEstoque(estoque, rop, es, cob);
  const reporQtd = quantidadeRepor(estoque, media, rop);

  const points = Array.isArray(chartData) ? [] : chartData?.points ?? [];
  const method = Array.isArray(chartData) ? "insufficient" : chartData?.method ?? "insufficient";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">{produto.cod_produto}</span>
            <span className="truncate">{produto.descricao}</span>
          </SheetTitle>
          <SheetDescription>
            {[produto.marca, produto.nome_linha].filter(Boolean).join(" · ") || "Sem marca / linha registrada"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Curva + forecast */}
          <Card className="p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-sm font-medium">Demanda mensal + previsão {FORECAST_HORIZON}m</div>
              <Badge variant="outline" className="text-[10px]">{forecastLabel(method)}</Badge>
            </div>
            {isLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : !serie || serie.length === 0 ? (
              <div className="h-40 grid place-items-center text-sm text-muted-foreground">Sem histórico de vendas.</div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: unknown) => (typeof v === "number" ? fmtNum(v) : "—")}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area dataKey="band" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.1} name="Banda 95%" isAnimationActive={false} />
                    <Bar dataKey="real" name="Vendido" fill="hsl(var(--primary))" radius={[2,2,0,0]} />
                    <Bar dataKey="forecast" name="Previsto" fill="hsl(var(--primary))" fillOpacity={0.4} radius={[2,2,0,0]} />
                    <Line dataKey="trend" name="Tendência" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Inventário */}
          <Card className="p-4">
            <div className="text-sm font-medium mb-3">Inventário (lead {leadDias}d · serviço {servico}%)</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Kpi label="Estoque atual" value={fmtNum(estoque)} />
              <Kpi label="Cobertura" value={Number.isFinite(cob) ? `${Math.round(cob)} dias` : "∞"} />
              <Kpi label="Giro anual" value={giro === null ? "—" : `${giro.toLocaleString("pt-BR",{maximumFractionDigits:1})}x`} />
              <Kpi label="Estoque segurança" value={fmtNum(Math.round(es))} />
              <Kpi label="Ponto de reposição" value={fmtNum(Math.round(rop))} />
              <Kpi label="Dias até ruptura" value={Number.isFinite(dRup) ? `${Math.round(dRup)} dias${dataRup ? ` (${format(dataRup,"dd/MM/yy")})` : ""}` : "—"} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Badge variant="outline" className={
                status === "critico" ? "bg-destructive/15 text-destructive border-destructive/30" :
                status === "repor" ? "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300" :
                status === "excesso" ? "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300" :
                "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300"
              }>
                Status: {status === "critico" ? "Crítico" : status === "repor" ? "Repor" : status === "excesso" ? "Excesso" : "OK"}
              </Badge>
              {reporQtd > 0 && (
                <div className="text-sm">
                  Recomendação: <span className="font-semibold">repor ~{fmtNum(reporQtd)} un</span>
                </div>
              )}
            </div>
          </Card>

          {/* Estatística + mini-histograma */}
          <Card className="p-4">
            <div className="text-sm font-medium mb-3">Estatística da demanda</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Kpi label="Média mensal" value={fmtNum(media)} />
              <Kpi label="Desvio (σ)" value={fmtNum(desvio)} />
              <Kpi label="CV" value={produto.cv === null ? "—" : produto.cv.toLocaleString("pt-BR",{maximumFractionDigits:2})} />
              <Kpi label="Classe ABC" value={produto.classe_abc} />
              <Kpi label="Classe XYZ" value={produto.classe_xyz} />
              <Kpi label="Meses ativos" value={`${produto.meses_com_venda} / ${produto.meses_no_periodo}`} />
              <Kpi label="Total no período" value={fmtNum(produto.qtd_total)} />
              <Kpi label="Receita no período" value={formatCurrency(Number(produto.valor_total) || 0)} />
            </div>

            {dist && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground mb-1">Distribuição mensal (média = {fmtNum(media)}, σ = {fmtNum(desvio)})</div>
                <div className="flex items-end gap-0.5 h-16">
                  {dist.values.map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-primary/70 rounded-sm min-h-[2px]"
                      style={{ height: `${(v / dist.max) * 100}%` }}
                      title={`${fmtNum(v)} un`}
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
