import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
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
import type { TopClient } from "@/hooks/useTradeExecutiveDashboard";

interface TradeExecutiveTopClientsProps {
  data?: TopClient[];
  isLoading: boolean;
}

export function TradeExecutiveTopClients({ data, isLoading }: TradeExecutiveTopClientsProps) {
  if (isLoading) {
    return <Skeleton className="h-[400px]" />;
  }

  // Preparar dados para o gráfico horizontal
  const chartData = data?.map(c => ({
    ...c,
    // Abreviar nome se muito longo
    clienteAbrev: c.cliente.length > 20 ? c.cliente.substring(0, 20) + "..." : c.cliente,
  })) || [];

  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Top 10 Clientes por Lançamentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`
                }
                className="fill-muted-foreground"
              />
              <YAxis
                type="category"
                dataKey="clienteAbrev"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={120}
                className="fill-muted-foreground"
              />
              <Tooltip
                formatter={(value: number) => [
                  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                  "Valor Total",
                ]}
                labelFormatter={(label) => {
                  const client = data?.find(c => c.cliente.startsWith(label.replace("...", "")));
                  return client?.cliente || label;
                }}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            Nenhum lançamento encontrado
          </div>
        )}
      </CardContent>
    </Card>
  );
}
