import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, PieChart, Trophy, TrendingUp } from "lucide-react";

interface BrandShareKPIsProps {
  totalMeasurements: number;
  avgShare: number;
  leadingBrand: string;
  growth: number;
}

export function BrandShareKPIs({ totalMeasurements, avgShare, leadingBrand, growth }: BrandShareKPIsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Medições</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalMeasurements}</div>
          <p className="text-xs text-muted-foreground">medições no período</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Share Médio</CardTitle>
          <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgShare.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">das nossas marcas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Marca Líder</CardTitle>
          <Trophy className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold truncate">{leadingBrand}</div>
          <p className="text-xs text-muted-foreground">maior espaço ocupado</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Crescimento</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">vs. período anterior</p>
        </CardContent>
      </Card>
    </div>
  );
}
