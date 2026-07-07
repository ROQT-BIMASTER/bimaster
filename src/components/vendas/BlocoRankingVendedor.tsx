import { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, LabelList, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useVendasRankingVendedor } from "@/hooks/useVendasAnalise";
import { formatCurrency } from "@/lib/formatters";
import { formatMi } from "@/lib/vendas/format";
import type { VendasFilters } from "@/hooks/useVendasAnalise";

const TOP_COLORS = [
  "hsl(var(--rv-steel))",
  "hsl(var(--rv-steel2))",
  "hsl(var(--rv-sage))",
  "hsl(var(--rv-tan))",
  "hsl(var(--rv-khaki))",
];
const TAIL_COLOR = "hsl(var(--rv-cinza-barra))";

type Metric = "fat" | "notas";

function initialOf(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "?") + (p[1]?.[0] ?? "")).toUpperCase();
}

interface Props {
  filters: VendasFilters;
  source?: "futura" | "rubysp";
}

export function BlocoRankingVendedor({ filters, source = "futura" }: Props) {
  const [metric, setMetric] = useState<Metric>("fat");
  const { data, isLoading } = useVendasRankingVendedor(filters, source);

  const rows = useMemo(() => {
    const all = (data ?? []).map((r) => ({
      nome: r.vendedor_nome,
      fat: r.faturamento,
      notas: r.notas,
    }));
    const sorted = [...all].sort((a, b) => (metric === "fat" ? b.fat - a.fat : b.notas - a.notas));
    const top = sorted.slice(0, 8);
    const tail = sorted.slice(8);
    const outros = tail.length
      ? [{ nome: "Outros", fat: tail.reduce((s, r) => s + r.fat, 0), notas: tail.reduce((s, r) => s + r.notas, 0) }]
      : [];
    return [...top, ...outros];
  }, [data, metric]);

  const values = rows.map((r) => (metric === "fat" ? r.fat : r.notas));
  const max = Math.max(1, ...values);
  const chartData = rows.map((r, i) => {
    const v = metric === "fat" ? r.fat : r.notas;
    return {
      nome: r.nome,
      inicial: r.nome === "Outros" ? "…" : initialOf(r.nome),
      valor: v,
      valorLabel: metric === "fat" ? formatMi(v) : v.toLocaleString("pt-BR"),
      fill: r.nome === "Outros" ? TAIL_COLOR : (TOP_COLORS[i] ?? TAIL_COLOR),
    };
  });

  return (
    <section className="pt-4">
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl text-rv-ink">Vendas por vendedor</h2>
          <p className="text-xs text-rv-text-suave mt-1">Ranking do período — top 8 + cauda agrupada.</p>
        </div>
        <div className="flex items-center gap-0 border border-rv-linha">
          {(["fat", "notas"] as Metric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`px-4 py-1.5 text-[11px] uppercase tracking-wider transition-colors ${
                m === metric ? "bg-rv-ink text-rv-bg" : "text-rv-text-suave hover:text-rv-ink"
              }`}
            >
              {m === "fat" ? "Faturamento" : "Nº pedidos"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : chartData.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-sm text-rv-text-suave border-t border-rv-linha">
          Sem vendas no período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 36, right: 8, left: 0, bottom: 48 }}>
            <XAxis
              dataKey="inicial"
              interval={0}
              tick={(props: any) => {
                const { x, y, payload, index } = props;
                const row = chartData[index];
                return (
                  <g transform={`translate(${x},${y})`}>
                    <circle cx={0} cy={2} r={13} fill={row?.fill ?? TAIL_COLOR} />
                    <text
                      x={0}
                      y={2}
                      dy={4}
                      textAnchor="middle"
                      fontSize={10}
                      fill="hsl(var(--rv-bg))"
                      style={{ fontWeight: 600 }}
                    >
                      {payload.value}
                    </text>
                    <text
                      x={0}
                      y={30}
                      textAnchor="middle"
                      fontSize={10}
                      fill="hsl(var(--rv-text-suave))"
                    >
                      {(row?.nome ?? "").length > 14 ? (row!.nome.slice(0, 12) + "…") : row?.nome}
                    </text>
                  </g>
                );
              }}
              axisLine={{ stroke: "hsl(var(--rv-linha))" }}
              tickLine={false}
              height={56}
            />
            <YAxis hide domain={[0, max * 1.15]} />
            <Tooltip
              cursor={{ fill: "hsl(var(--rv-faixa-verde))" }}
              contentStyle={{
                borderRadius: 4,
                border: "1px solid hsl(var(--rv-linha))",
                background: "hsl(var(--rv-bg))",
                fontSize: 12,
              }}
              formatter={(v: number) => [
                metric === "fat" ? formatCurrency(v) : v.toLocaleString("pt-BR"),
                metric === "fat" ? "Faturamento" : "Notas",
              ]}
              labelFormatter={(_l, p) => (p?.[0]?.payload as any)?.nome ?? ""}
            />
            <Bar dataKey="valor" radius={[10, 10, 0, 0]} maxBarSize={64}>
              {chartData.map((r, i) => (
                <Cell key={i} fill={r.fill} />
              ))}
              <LabelList
                dataKey="valorLabel"
                position="top"
                style={{ fill: "hsl(var(--rv-ink))", fontSize: 11, fontWeight: 500 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
