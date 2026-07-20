import { useMemo } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useVendasSerieMensalCliente } from "@/hooks/vendas/useVendasSerieMensalCliente";
import { buildForecast } from "@/lib/vendas/forecast";
import { formatMi } from "@/lib/vendas/format";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  clienteFuturaId: number;
  source?: "futura" | "rubysp";
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function labelMes(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MESES_ABREV[(m - 1) % 12]}/${String(y).slice(2)}`;
}

export function ClienteForecastChart({ clienteFuturaId, source = "futura" }: Props) {
  const { data, isLoading, error } = useVendasSerieMensalCliente(clienteFuturaId, source);

  const { pontos, suficiente } = useMemo(() => {
    return buildForecast(data ?? [], { janela: 12, horizonte: 6 });
  }, [data]);

  const chartData = useMemo(
    () => pontos.map((p) => ({
      ...p,
      mesLabel: labelMes(p.mes),
      bandaSpan: p.bandaMin != null && p.bandaMax != null ? p.bandaMax - p.bandaMin : null,
    })),
    [pontos],
  );

  if (isLoading) {
    return (
      <div className="p-6 border-t border-rv-linha">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border-t border-rv-linha text-sm text-rv-negativo">
        Não foi possível carregar o histórico deste cliente.
      </div>
    );
  }

  if (!suficiente) {
    return (
      <div className="p-6 border-t border-rv-linha text-sm text-rv-text-suave text-center">
        Sem histórico suficiente para projeção — mínimo 6 meses de venda.
      </div>
    );
  }

  return (
    <div className="p-6 border-t border-rv-linha">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="font-display text-base text-rv-ink">Forecast · próximos 6 meses</h3>
          <p className="text-[11px] text-rv-text-suave mt-0.5">
            Histórico dos últimos 24 meses e projeção estatística com banda ±1σ.
          </p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--rv-linha))" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="mesLabel"
              tick={{ fontSize: 11, fill: "hsl(var(--rv-text-suave))" }}
              axisLine={{ stroke: "hsl(var(--rv-linha))" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatMi(v)}
              tick={{ fontSize: 11, fill: "hsl(var(--rv-text-suave))" }}
              axisLine={{ stroke: "hsl(var(--rv-linha))" }}
              tickLine={false}
              width={64}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--rv-bg))",
                border: "1px solid hsl(var(--rv-linha))",
                borderRadius: 0,
                color: "hsl(var(--rv-ink))",
                boxShadow: "0 6px 24px -12px hsl(var(--rv-ink) / 0.25)",
                padding: "8px 10px",
              }}
              labelStyle={{ color: "hsl(var(--rv-ink))", fontWeight: 600, fontSize: 12, marginBottom: 4 }}
              itemStyle={{ color: "hsl(var(--rv-ink))", fontSize: 12, padding: 0 }}
              formatter={(value: any, name: any) => {
                if (value == null) return ["—", String(name)];
                const map: Record<string, string> = {
                  historico: "Histórico",
                  projecao: "Projeção",
                  bandaMin: "Piso ±1σ",
                  bandaSpan: "Teto ±1σ",
                };
                return [formatCurrency(Number(value)), map[String(name)] ?? String(name)];
              }}
            />
            <Legend
              verticalAlign="top"
              height={24}
              iconType="plainline"
              wrapperStyle={{ fontSize: 11, color: "hsl(var(--rv-ink))" }}
              formatter={(value) => {
                if (value === "historico") return "Histórico";
                if (value === "projecao") return "Projeção";
                if (value === "bandaSpan") return "Banda ±1σ";
                return value;
              }}
            />
            {/* banda como área empilhada: baseline invisível + span visível */}
            <Area
              type="monotone"
              dataKey="bandaMin"
              stackId="banda"
              stroke="none"
              fill="transparent"
              legendType="none"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="bandaSpan"
              stackId="banda"
              stroke="none"
              fill="hsl(var(--rv-faixa-verde))"
              fillOpacity={0.5}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="historico"
              stroke="hsl(var(--rv-ink))"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "hsl(var(--rv-ink))" }}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="projecao"
              stroke="hsl(var(--rv-steel))"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 2.5, fill: "hsl(var(--rv-steel))" }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-wider text-rv-text-suave">
        Projeção estatística simples (regressão linear · últimos 12 meses). Referencial, não substitui orçamento comercial.
      </p>
    </div>
  );
}
