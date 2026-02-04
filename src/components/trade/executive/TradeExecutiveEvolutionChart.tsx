import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TrendingUp, AreaChart, BarChart3, LineChart as LineChartIcon } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  ComposedChart,
  Bar,
  BarChart,
} from "recharts";
import type { MonthlyEvolution } from "@/hooks/useTradeExecutiveDashboard";

type ChartType = "area" | "bar" | "line";

interface TradeExecutiveEvolutionChartProps {
  data?: MonthlyEvolution[];
  isLoading: boolean;
}

export function TradeExecutiveEvolutionChart({ data, isLoading }: TradeExecutiveEvolutionChartProps) {
  const [chartType, setChartType] = useState<ChartType>("area");

  if (isLoading) {
    return <Skeleton className="h-[350px]" />;
  }

  const renderChart = () => {
    if (!data || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
          Dados de evolução não disponíveis
        </div>
      );
    }

    const commonProps = {
      data,
    };

    const tooltipStyle = {
      contentStyle: {
        backgroundColor: "hsl(var(--background))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "8px",
      },
      labelStyle: { color: "hsl(var(--foreground))" },
    };

    const legendFormatter = (value: string) => (
      <span className="text-sm text-muted-foreground">{value}</span>
    );

    if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
            <Tooltip {...tooltipStyle} />
            <Legend verticalAlign="top" height={36} formatter={legendFormatter} />
            <Bar dataKey="visitas" name="Visitas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="fotos" name="Fotos" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="fotosProcessadas" name="Fotos Processadas (IA)" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
            <Tooltip {...tooltipStyle} />
            <Legend verticalAlign="top" height={36} formatter={legendFormatter} />
            <Line type="monotone" dataKey="visitas" name="Visitas" stroke="hsl(var(--chart-1))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="fotos" name="Fotos" stroke="hsl(var(--chart-2))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="fotosProcessadas" name="Fotos Processadas (IA)" stroke="hsl(var(--chart-3))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Default: Area chart (ComposedChart with Area + Lines)
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart {...commonProps}>
          <defs>
            <linearGradient id="colorFotosProcessadas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="mes" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
          <Tooltip {...tooltipStyle} />
          <Legend verticalAlign="top" height={36} formatter={legendFormatter} />
          <Area type="monotone" dataKey="fotosProcessadas" name="Fotos Processadas (IA)" fill="url(#colorFotosProcessadas)" stroke="hsl(var(--chart-3))" strokeWidth={2} />
          <Line type="monotone" dataKey="visitas" name="Visitas" stroke="hsl(var(--chart-1))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="fotos" name="Fotos" stroke="hsl(var(--chart-2))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Evolução Mensal - Visitas e Fotos
          </CardTitle>
          <ToggleGroup type="single" value={chartType} onValueChange={(value) => value && setChartType(value as ChartType)} size="sm">
            <ToggleGroupItem value="area" aria-label="Gráfico de Área" title="Área">
              <AreaChart className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="bar" aria-label="Gráfico de Barras" title="Barras">
              <BarChart3 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="line" aria-label="Gráfico de Linhas" title="Linhas">
              <LineChartIcon className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
}
