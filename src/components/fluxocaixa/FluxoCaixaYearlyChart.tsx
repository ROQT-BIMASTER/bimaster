import React, { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { BarChart3, TrendingUp, AreaChart as AreaChartIcon } from "lucide-react";

type ViewType = "yearly" | "monthly" | "quarterly";
type ChartType = "bar" | "line" | "area";

interface FluxoCaixaYearlyChartProps {
  contasReceber: any[];
  contasPagar: any[];
  filterAnos: number[];
}

const MESES_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const TRIMESTRE_LABELS = ["1º Tri", "2º Tri", "3º Tri", "4º Tri"];

export const FluxoCaixaYearlyChart = memo(function FluxoCaixaYearlyChart({
  contasReceber,
  contasPagar,
  filterAnos
}: FluxoCaixaYearlyChartProps) {
  const [viewType, setViewType] = useState<ViewType>("monthly");
  const [chartType, setChartType] = useState<ChartType>("bar");

  // Group data by year
  const yearlyData = useMemo(() => {
    const data: Record<number, { entradas: number; saidas: number; saldo: number }> = {};
    
    contasReceber.forEach(c => {
      if (!c.data_vencimento) return;
      const ano = new Date(c.data_vencimento).getFullYear();
      if (!data[ano]) data[ano] = { entradas: 0, saidas: 0, saldo: 0 };
      data[ano].entradas += c.valor_aberto || 0;
    });
    
    contasPagar.forEach(c => {
      if (!c.data_vencimento) return;
      const ano = new Date(c.data_vencimento).getFullYear();
      if (!data[ano]) data[ano] = { entradas: 0, saidas: 0, saldo: 0 };
      data[ano].saidas += c.valor_aberto || 0;
    });
    
    return Object.entries(data)
      .map(([ano, vals]) => ({
        periodo: ano,
        ano: parseInt(ano),
        entradas: vals.entradas,
        saidas: vals.saidas,
        saldo: vals.entradas - vals.saidas
      }))
      .sort((a, b) => a.ano - b.ano);
  }, [contasReceber, contasPagar]);

  // Group data by month
  const monthlyData = useMemo(() => {
    const data: Record<string, { entradas: number; saidas: number; ano: number; mes: number }> = {};
    
    contasReceber.forEach(c => {
      if (!c.data_vencimento) return;
      const date = new Date(c.data_vencimento);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!data[key]) data[key] = { entradas: 0, saidas: 0, ano: date.getFullYear(), mes: date.getMonth() + 1 };
      data[key].entradas += c.valor_aberto || 0;
    });
    
    contasPagar.forEach(c => {
      if (!c.data_vencimento) return;
      const date = new Date(c.data_vencimento);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!data[key]) data[key] = { entradas: 0, saidas: 0, ano: date.getFullYear(), mes: date.getMonth() + 1 };
      data[key].saidas += c.valor_aberto || 0;
    });
    
    return Object.entries(data)
      .map(([key, vals]) => ({
        periodo: `${MESES_LABELS[vals.mes - 1]}/${vals.ano}`,
        key,
        ano: vals.ano,
        mes: vals.mes,
        entradas: vals.entradas,
        saidas: vals.saidas,
        saldo: vals.entradas - vals.saidas
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [contasReceber, contasPagar]);

  // Group data by quarter
  const quarterlyData = useMemo(() => {
    const data: Record<string, { entradas: number; saidas: number; ano: number; trimestre: number }> = {};
    
    contasReceber.forEach(c => {
      if (!c.data_vencimento) return;
      const date = new Date(c.data_vencimento);
      const trimestre = Math.floor(date.getMonth() / 3) + 1;
      const key = `${date.getFullYear()}-Q${trimestre}`;
      if (!data[key]) data[key] = { entradas: 0, saidas: 0, ano: date.getFullYear(), trimestre };
      data[key].entradas += c.valor_aberto || 0;
    });
    
    contasPagar.forEach(c => {
      if (!c.data_vencimento) return;
      const date = new Date(c.data_vencimento);
      const trimestre = Math.floor(date.getMonth() / 3) + 1;
      const key = `${date.getFullYear()}-Q${trimestre}`;
      if (!data[key]) data[key] = { entradas: 0, saidas: 0, ano: date.getFullYear(), trimestre };
      data[key].saidas += c.valor_aberto || 0;
    });
    
    return Object.entries(data)
      .map(([key, vals]) => ({
        periodo: `${TRIMESTRE_LABELS[vals.trimestre - 1]}/${vals.ano}`,
        key,
        ano: vals.ano,
        trimestre: vals.trimestre,
        entradas: vals.entradas,
        saidas: vals.saidas,
        saldo: vals.entradas - vals.saidas
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [contasReceber, contasPagar]);

  const chartData = useMemo(() => {
    switch (viewType) {
      case "yearly": return yearlyData;
      case "quarterly": return quarterlyData;
      default: return monthlyData;
    }
  }, [viewType, yearlyData, monthlyData, quarterlyData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
    return `R$ ${value.toFixed(0)}`;
  };

  const formatTooltip = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0
    }).format(value);
  };

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    const tooltipStyle = {
      backgroundColor: "hsl(var(--background))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "8px"
    };

    if (chartType === "line") {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="periodo" tick={{ fontSize: 11 }} angle={viewType === "monthly" ? -45 : 0} textAnchor={viewType === "monthly" ? "end" : "middle"} height={viewType === "monthly" ? 60 : 30} />
          <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
          <Tooltip formatter={formatTooltip} contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="entradas" name="Entradas" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="saidas" name="Saídas" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5 }} />
        </LineChart>
      );
    }

    if (chartType === "area") {
      return (
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="periodo" tick={{ fontSize: 11 }} angle={viewType === "monthly" ? -45 : 0} textAnchor={viewType === "monthly" ? "end" : "middle"} height={viewType === "monthly" ? 60 : 30} />
          <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
          <Tooltip formatter={formatTooltip} contentStyle={tooltipStyle} />
          <Legend />
          <Area type="monotone" dataKey="entradas" name="Entradas" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.5} />
          <Area type="monotone" dataKey="saidas" name="Saídas" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.5} />
        </AreaChart>
      );
    }

    return (
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="periodo" tick={{ fontSize: 11 }} angle={viewType === "monthly" ? -45 : 0} textAnchor={viewType === "monthly" ? "end" : "middle"} height={viewType === "monthly" ? 60 : 30} />
        <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
        <Tooltip formatter={formatTooltip} contentStyle={tooltipStyle} />
        <Legend />
        <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
      </BarChart>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <CardTitle className="text-base">Análise Comparativa</CardTitle>
          <div className="flex items-center gap-2">
            {/* View Type */}
            <Tabs value={viewType} onValueChange={(v) => setViewType(v as ViewType)} className="h-8">
              <TabsList className="h-8">
                <TabsTrigger value="monthly" className="text-xs h-7 px-2">Mensal</TabsTrigger>
                <TabsTrigger value="quarterly" className="text-xs h-7 px-2">Trimestral</TabsTrigger>
                <TabsTrigger value="yearly" className="text-xs h-7 px-2">Anual</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Chart Type */}
            <div className="flex gap-1">
              <Button 
                variant={chartType === "bar" ? "default" : "outline"} 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setChartType("bar")}
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button 
                variant={chartType === "line" ? "default" : "outline"} 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setChartType("line")}
              >
                <TrendingUp className="h-4 w-4" />
              </Button>
              <Button 
                variant={chartType === "area" ? "default" : "outline"} 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setChartType("area")}
              >
                <AreaChartIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});
