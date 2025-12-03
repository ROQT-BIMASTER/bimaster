import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, DollarSign, Percent, Package } from "lucide-react";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";

interface Props {
  tabelas: any[];
  precos?: any[];
}

export function DashboardPrecosAnalytics({ tabelas, precos = [] }: Props) {
  const analytics = useMemo(() => {
    // Calcular estatísticas de tabelas
    const tabelasAtivas = tabelas.filter(t => t.ativo);
    const tabelasPendentes = tabelas.filter(t => t.status === "pending_approval");
    const tabelasAprovadas = tabelas.filter(t => t.status === "approved");

    // Calcular distribuição de margens
    const margemBaixissima = precos.filter(p => (p.margem_lucro_percentual || 0) < 10).length;
    const margemBaixa = precos.filter(p => (p.margem_lucro_percentual || 0) >= 10 && (p.margem_lucro_percentual || 0) < 20).length;
    const margemMedia = precos.filter(p => (p.margem_lucro_percentual || 0) >= 20 && (p.margem_lucro_percentual || 0) < 30).length;
    const margemAlta = precos.filter(p => (p.margem_lucro_percentual || 0) >= 30 && (p.margem_lucro_percentual || 0) < 50).length;
    const margemAltissima = precos.filter(p => (p.margem_lucro_percentual || 0) >= 50).length;

    const distribuicaoMargem = [
      { name: "< 10%", value: margemBaixissima, color: "hsl(var(--destructive))" },
      { name: "10-20%", value: margemBaixa, color: "hsl(30, 100%, 50%)" },
      { name: "20-30%", value: margemMedia, color: "hsl(45, 100%, 50%)" },
      { name: "30-50%", value: margemAlta, color: "hsl(120, 60%, 50%)" },
      { name: "> 50%", value: margemAltissima, color: "hsl(210, 100%, 50%)" },
    ].filter(d => d.value > 0);

    // Calcular distribuição de faixas de preço
    const precoBaixo = precos.filter(p => (p.preco_final || 0) < 50).length;
    const precoMedioBaixo = precos.filter(p => (p.preco_final || 0) >= 50 && (p.preco_final || 0) < 100).length;
    const precoMedio = precos.filter(p => (p.preco_final || 0) >= 100 && (p.preco_final || 0) < 250).length;
    const precoMedioAlto = precos.filter(p => (p.preco_final || 0) >= 250 && (p.preco_final || 0) < 500).length;
    const precoAlto = precos.filter(p => (p.preco_final || 0) >= 500).length;

    const distribuicaoPreco = [
      { name: "< R$50", produtos: precoBaixo },
      { name: "R$50-100", produtos: precoMedioBaixo },
      { name: "R$100-250", produtos: precoMedio },
      { name: "R$250-500", produtos: precoMedioAlto },
      { name: "> R$500", produtos: precoAlto },
    ];

    // Calcular médias
    const margemMediaGeral = precos.length > 0 
      ? precos.reduce((acc, p) => acc + (p.margem_lucro_percentual || 0), 0) / precos.length 
      : 0;
    const precoMedioGeral = precos.length > 0 
      ? precos.reduce((acc, p) => acc + (p.preco_final || 0), 0) / precos.length 
      : 0;
    const custoMedioGeral = precos.length > 0 
      ? precos.reduce((acc, p) => acc + (p.custo_base || 0), 0) / precos.length 
      : 0;

    // Produtos com margem crítica (abaixo de 10%)
    const produtosCriticos = precos.filter(p => (p.margem_lucro_percentual || 0) < 10);

    return {
      tabelasAtivas: tabelasAtivas.length,
      tabelasPendentes: tabelasPendentes.length,
      tabelasAprovadas: tabelasAprovadas.length,
      totalProdutos: precos.length,
      distribuicaoMargem,
      distribuicaoPreco,
      margemMediaGeral,
      precoMedioGeral,
      custoMedioGeral,
      produtosCriticos: produtosCriticos.length,
    };
  }, [tabelas, precos]);

  const getMargemTrend = (margem: number) => {
    if (margem >= 25) return { icon: TrendingUp, color: "text-green-600", label: "Saudável" };
    if (margem >= 15) return { icon: Minus, color: "text-yellow-600", label: "Moderada" };
    return { icon: TrendingDown, color: "text-red-600", label: "Crítica" };
  };

  const trend = getMargemTrend(analytics.margemMediaGeral);
  const TrendIcon = trend.icon;

  return (
    <div className="space-y-6">
      {/* KPIs Expandidos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem Média</CardTitle>
            <TrendIcon className={`h-4 w-4 ${trend.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.margemMediaGeral.toFixed(1)}%</div>
            <Badge variant={analytics.margemMediaGeral >= 20 ? "default" : "destructive"} className="mt-1">
              {trend.label}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preço Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatarMoeda(analytics.precoMedioGeral)}</div>
            <p className="text-xs text-muted-foreground">
              Custo: {formatarMoeda(analytics.custoMedioGeral)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tabelas Aprovadas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.tabelasAprovadas}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.tabelasAtivas} ativas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.tabelasPendentes}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando aprovação
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${analytics.produtosCriticos > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem Crítica</CardTitle>
            {analytics.produtosCriticos > 0 ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.produtosCriticos}</div>
            <p className="text-xs text-muted-foreground">
              Produtos com margem {"<"} 10%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Gráfico de Pizza - Distribuição de Margens */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Distribuição de Margens
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.distribuicaoMargem.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analytics.distribuicaoMargem}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {analytics.distribuicaoMargem.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} produtos`, 'Quantidade']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Nenhum dado de preços disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Barras - Faixas de Preço */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Produtos por Faixa de Preço
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.totalProdutos > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.distribuicaoPreco}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="produtos" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    name="Produtos"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Nenhum dado de preços disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
