import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Users } from "lucide-react";

interface CurvaData {
  curva: string;
  count: number;
  valor: number;
}

interface TradeExecutiveCurvaChartProps {
  data?: CurvaData[];
  isLoading: boolean;
}

const CURVA_COLORS: Record<string, string> = {
  'A': 'hsl(var(--chart-1))',
  'B': 'hsl(var(--chart-2))',
  'C': 'hsl(var(--chart-3))',
  'D': 'hsl(var(--chart-4))',
  'Não classificado': 'hsl(var(--muted-foreground))',
};

export function TradeExecutiveCurvaChart({ data, isLoading }: TradeExecutiveCurvaChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[350px]" />;
  }

  const chartData = data?.map(d => ({
    name: `Curva ${d.curva}`,
    value: d.count,
    valor: d.valor,
    fill: CURVA_COLORS[d.curva] || 'hsl(var(--muted))',
  })) || [];

  const totalClientes = chartData.reduce((sum, d) => sum + d.value, 0);
  const totalValor = chartData.reduce((sum, d) => sum + d.valor, 0);

  if (!chartData.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Distribuição por Curva de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[250px] text-muted-foreground">
            Nenhum dado de curva disponível
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Distribuição por Curva de Clientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfico de Pizza */}
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value} clientes - ${props.payload.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                    name
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Resumo por Curva */}
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground mb-2">
              Total: {totalClientes} clientes | {totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            {data?.map((item) => (
              <div key={item.curva} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: CURVA_COLORS[item.curva] || 'hsl(var(--muted))' }} 
                  />
                  <span className="font-medium">Curva {item.curva}</span>
                </div>
                <div className="text-right">
                  <div className="font-medium">{item.count} clientes</div>
                  <div className="text-xs text-muted-foreground">
                    {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
