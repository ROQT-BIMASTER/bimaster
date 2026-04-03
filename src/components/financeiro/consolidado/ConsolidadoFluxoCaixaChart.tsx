import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Legend,
} from "recharts";
import { TrendingUp, Calendar } from "lucide-react";
import type { FluxoCaixaItem } from "@/hooks/useFinanceiroConsolidadoDashboard";
import { formatCurrency } from "@/lib/formatters";

interface ConsolidadoFluxoCaixaChartProps {
  data: FluxoCaixaItem[];
}

const formatCurrencyNoDecimals = (value: number) => formatCurrency(value, false);

export function ConsolidadoFluxoCaixaChart({ data }: ConsolidadoFluxoCaixaChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const totalEntradas = data.reduce((sum, d) => sum + d.entradas, 0);
  const totalSaidas = data.reduce((sum, d) => sum + d.saidas, 0);
  const saldoFinal = data.length > 0 ? data[data.length - 1].saldo : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Fluxo de Caixa Consolidado
          </CardTitle>
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <Calendar className="h-4 w-4" />
            Últimos 6 meses
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground">Entradas</p>
            <p className="font-bold text-emerald-500">{formatCurrency(totalEntradas)}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Saídas</p>
            <p className="font-bold text-destructive">{formatCurrency(totalSaidas)}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Saldo</p>
            <p className={`font-bold ${saldoFinal >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatCurrency(saldoFinal)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                className="fill-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: "20px" }} />
              <Bar dataKey="entradas" name="Entradas" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="saldo"
                name="Saldo Acumulado"
                stroke="hsl(221, 83%, 53%)"
                strokeWidth={3}
                dot={{ fill: "hsl(221, 83%, 53%)", strokeWidth: 2, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
