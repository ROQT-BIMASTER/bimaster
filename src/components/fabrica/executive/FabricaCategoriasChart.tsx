import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend 
} from "recharts";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChartIcon, TableIcon } from "lucide-react";
import type { CategoriaAnalise } from "@/hooks/useFabricaExecutiveDashboard";

interface Props {
  categorias: CategoriaAnalise[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142.1 76.2% 36.3%)',
  'hsl(25 95% 53%)',
  'hsl(262.1 83.3% 57.8%)',
  'hsl(199.4 95.5% 53.8%)',
  'hsl(45 93% 47%)',
  'hsl(330 81% 60%)',
  'hsl(173 80% 40%)',
];

export function FabricaCategoriasChart({ categorias }: Props) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const chartData = categorias.map((cat, i) => ({
    name: cat.categoria,
    value: cat.quantidadeProdutos,
    receita: cat.receitaPotencial,
    margem: cat.margemMedia,
    custo: cat.custoMedio,
    color: COLORS[i % COLORS.length]
  }));

  if (categorias.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5" />
            Análise por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nenhuma categoria disponível
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PieChartIcon className="h-5 w-5" />
          Análise por Categoria
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="grafico">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="grafico" className="gap-2">
              <PieChartIcon className="h-4 w-4" />
              Gráfico
            </TabsTrigger>
            <TabsTrigger value="tabela" className="gap-2">
              <TableIcon className="h-4 w-4" />
              Tabela
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="grafico" className="mt-4">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
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
                        <div><strong>{item.name}</strong></div>
                        <div>Produtos: {item.value}</div>
                        <div>Margem Média: {item.margem.toFixed(1)}%</div>
                        <div>Receita: {formatCurrency(item.receita)}</div>
                      </div>,
                      ''
                    ];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </TabsContent>
          
          <TabsContent value="tabela" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Produtos</TableHead>
                  <TableHead className="text-right">Custo Médio</TableHead>
                  <TableHead className="text-right">Margem Média</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categorias.map((cat, i) => (
                  <TableRow key={cat.categoria}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        {cat.categoria}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{cat.quantidadeProdutos}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cat.custoMedio)}</TableCell>
                    <TableCell className="text-right">{cat.margemMedia.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(cat.receitaPotencial)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
