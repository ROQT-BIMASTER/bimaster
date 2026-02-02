import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { ProdutoMargem } from "@/hooks/useFabricaExecutiveDashboard";

interface Props {
  melhores: ProdutoMargem[];
  piores: ProdutoMargem[];
}

export function FabricaTopMargens({ melhores, piores }: Props) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const getBarColor = (margem: number, type: 'melhores' | 'piores') => {
    if (type === 'melhores') {
      if (margem >= 40) return 'hsl(142.1 76.2% 36.3%)';
      if (margem >= 30) return 'hsl(142.1 70.6% 45.3%)';
      return 'hsl(142.1 64.2% 54.3%)';
    } else {
      if (margem < 5) return 'hsl(0 84.2% 60.2%)';
      if (margem < 10) return 'hsl(25 95% 53%)';
      return 'hsl(45 93% 47%)';
    }
  };

  const renderBarChart = (data: ProdutoMargem[], type: 'melhores' | 'piores') => {
    const chartData = data.slice(0, 10).map(p => ({
      nome: p.nome.length > 20 ? p.nome.substring(0, 20) + '...' : p.nome,
      nomeCompleto: p.nome,
      margem: p.margem,
      custo: p.custoBase,
      preco: p.precoFinal
    }));

    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-[350px] text-muted-foreground">
          Nenhum dado disponível
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            type="number" 
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            tickFormatter={(v) => `${v.toFixed(0)}%`}
          />
          <YAxis 
            type="category" 
            dataKey="nome" 
            tick={{ fontSize: 11 }}
            className="fill-muted-foreground"
            width={150}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string, props: any) => {
              const item = props.payload;
              return [
                <div key="content" className="space-y-1">
                  <div><strong>{item.nomeCompleto}</strong></div>
                  <div>Margem: {item.margem.toFixed(1)}%</div>
                  <div>Custo: {formatCurrency(item.custo)}</div>
                  <div>Preço: {formatCurrency(item.preco)}</div>
                </div>,
                ''
              ];
            }}
          />
          <Bar dataKey="margem" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.margem, type)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise de Margens por Produto</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="melhores">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="melhores" className="gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Melhores Margens
            </TabsTrigger>
            <TabsTrigger value="piores" className="gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Menores Margens
            </TabsTrigger>
          </TabsList>
          <TabsContent value="melhores" className="mt-4">
            {renderBarChart(melhores, 'melhores')}
          </TabsContent>
          <TabsContent value="piores" className="mt-4">
            {renderBarChart(piores, 'piores')}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
