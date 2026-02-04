import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface MonthlyEvolution {
  month: string;
  [brandName: string]: string | number;
}

interface BrandShareEvolutionChartProps {
  data: MonthlyEvolution[];
  brandNames: string[];
  brandColors: Record<string, string>;
}

export function BrandShareEvolutionChart({ data, brandNames, brandColors }: BrandShareEvolutionChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução Mensal</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Sem dados para exibir</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evolução Mensal por Marca</CardTitle>
      </CardHeader>
      <CardContent className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis className="text-xs" tickFormatter={(value) => `${value}`} />
            <Tooltip
              formatter={(value: number, name: string) => [`${value.toFixed(0)} cm`, name]}
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            {brandNames.map((brandName) => (
              <Line
                key={brandName}
                type="monotone"
                dataKey={brandName}
                stroke={brandColors[brandName] || "hsl(var(--muted-foreground))"}
                strokeWidth={2}
                dot={{ fill: brandColors[brandName] || "hsl(var(--muted-foreground))", strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
