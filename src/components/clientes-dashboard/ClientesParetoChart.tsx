import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Line, ComposedChart, ResponsiveContainer, CartesianGrid } from "recharts";

interface ParetoItem {
  cod_cliente: number;
  nome: string;
  receita: number;
  pctAcumulado: number;
}

interface Props {
  data: ParetoItem[];
  isLoading: boolean;
}

const fmtMoeda = (v: number) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
};

export function ClientesParetoChart({ data, isLoading }: Props) {
  if (isLoading) {
    return <Card><CardContent className="p-4"><Skeleton className="h-80 w-full" /></CardContent></Card>;
  }

  const chartData = data.slice(0, 20).map((d, i) => ({
    nome: d.nome.length > 15 ? d.nome.substring(0, 15) + "…" : d.nome,
    receita: d.receita,
    acumulado: d.pctAcumulado,
  }));

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Pareto de Clientes (Top 20)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="nome" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
            <YAxis yAxisId="left" tickFormatter={fmtMoeda} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: any, name: string) => [
                name === "receita" ? fmtMoeda(value) : `${Number(value).toFixed(1)}%`,
                name === "receita" ? "Receita" : "% Acumulado"
              ]}
            />
            <Bar yAxisId="left" dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="acumulado" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
