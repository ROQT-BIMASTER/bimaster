import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketCoverageRow } from "@/hooks/useMarketCoverage";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface PenetrationChartProps {
  data: MarketCoverageRow[];
  isLoading: boolean;
}

const getBarColor = (pct: number) => {
  if (pct >= 20) return "#10b981";
  if (pct >= 10) return "#3b82f6";
  if (pct >= 5) return "#f59e0b";
  if (pct > 0) return "#f97316";
  return "#d1d5db";
};

export function PenetrationChart({ data, isLoading }: PenetrationChartProps) {
  const chartData = useMemo(() => {
    return data
      .filter((r) => r.penetracao_percentual > 0 || r.total_clientes_erp > 0)
      .sort((a, b) => b.penetracao_percentual - a.penetracao_percentual)
      .slice(0, 20)
      .map((r) => ({
        uf: r.uf,
        penetracao: Number(r.penetracao_percentual),
        clientes: r.total_clientes_erp,
        municipios: r.municipios_com_clientes,
      }));
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-[400px] animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Penetração por UF (Top 20)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" unit="%" fontSize={12} />
              <YAxis dataKey="uf" type="category" width={35} fontSize={12} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "penetracao") return [`${value.toFixed(1)}%`, "Penetração"];
                  return [value, name];
                }}
                labelFormatter={(label) => `Estado: ${label}`}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  backgroundColor: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                }}
              />
              <Bar dataKey="penetracao" radius={[0, 4, 4, 0]} barSize={18}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.penetracao)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> ≥20%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> ≥10%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> ≥5%</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" /> &lt;5%</span>
        </div>
      </CardContent>
    </Card>
  );
}
