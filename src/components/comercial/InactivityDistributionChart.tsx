import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ClienteReativacao } from "@/hooks/useClienteReativacao";

interface Props {
  clientes: ClienteReativacao[];
}

export function InactivityDistributionChart({ clientes }: Props) {
  // Agrupar clientes em buckets de 15 dias
  const buckets: Record<number, number> = {};
  for (const c of clientes) {
    const bucket = Math.floor(c.dias_sem_compra / 15) * 15;
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  }

  const data = Object.entries(buckets)
    .map(([dias, count]) => ({ dias: Number(dias), clientes: count }))
    .sort((a, b) => a.dias - b.dias)
    .filter((d) => d.dias <= 730); // Limitar a 2 anos

  const getColor = (dias: number) => {
    if (dias <= 60) return "#f59e0b";
    if (dias <= 90) return "#f97316";
    if (dias <= 180) return "#ef4444";
    return "#6b7280";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Distribuição de Inatividade</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="colorInatividade" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="20%" stopColor="#f97316" stopOpacity={0.8} />
                  <stop offset="40%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#6b7280" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="dias"
                fontSize={11}
                tickFormatter={(v) => `${v}d`}
              />
              <YAxis fontSize={11} />
              <Tooltip
                formatter={(value: number) => [value, "Clientes"]}
                labelFormatter={(label) => `${label}-${Number(label) + 14} dias`}
                contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
              />
              <Area
                type="monotone"
                dataKey="clientes"
                stroke="#ef4444"
                fill="url(#colorInatividade)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
