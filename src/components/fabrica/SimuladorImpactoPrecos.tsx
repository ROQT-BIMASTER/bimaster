import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Minus,
  DollarSign,
  Percent,
  Package,
  Activity
} from "lucide-react";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";

interface Props {
  precosAtuais: any[];
  precosNovos: any[];
  tabela: any;
}

export function SimuladorImpactoPrecos({ precosAtuais, precosNovos, tabela }: Props) {
  const impacto = useMemo(() => {
    if (!precosNovos?.length) {
      return null;
    }

    // Criar mapa de preços atuais
    const precosAtuaisMap = new Map(
      precosAtuais.map(p => [p.produto_id, p])
    );

    // Calcular variações
    let totalAumentos = 0;
    let totalReducoes = 0;
    let totalSemAlteracao = 0;
    let somaVariacao = 0;
    let maiorAumento = { produto_id: '', variacao: 0, nome: '' };
    let maiorReducao = { produto_id: '', variacao: 0, nome: '' };

    const variacoes: { nome: string; variacao: number; precoAntigo: number; precoNovo: number }[] = [];

    precosNovos.forEach(precoNovo => {
      const precoAtual = precosAtuaisMap.get(precoNovo.produto_id);
      const precoAntigoVal = precoAtual?.preco_final || precoNovo.custo_base || 0;
      const precoNovoVal = precoNovo.preco_final || 0;

      if (precoAntigoVal === 0) return;

      const variacao = ((precoNovoVal - precoAntigoVal) / precoAntigoVal) * 100;
      somaVariacao += variacao;

      variacoes.push({
        nome: precoNovo.produto_nome || precoNovo.produto_id?.substring(0, 8),
        variacao,
        precoAntigo: precoAntigoVal,
        precoNovo: precoNovoVal,
      });

      if (variacao > 0.5) {
        totalAumentos++;
        if (variacao > maiorAumento.variacao) {
          maiorAumento = { 
            produto_id: precoNovo.produto_id, 
            variacao, 
            nome: precoNovo.produto_nome || '-'
          };
        }
      } else if (variacao < -0.5) {
        totalReducoes++;
        if (variacao < maiorReducao.variacao) {
          maiorReducao = { 
            produto_id: precoNovo.produto_id, 
            variacao, 
            nome: precoNovo.produto_nome || '-'
          };
        }
      } else {
        totalSemAlteracao++;
      }
    });

    // Top 5 maiores variações (ordenados por valor absoluto)
    const topVariacoes = [...variacoes]
      .sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao))
      .slice(0, 10);

    // Calcular média
    const variacaoMedia = precosNovos.length > 0 ? somaVariacao / precosNovos.length : 0;

    // Calcular margens
    const margemMediaNova = precosNovos.reduce((acc, p) => 
      acc + (p.margem_lucro_percentual ?? p.margem_lucro ?? 0), 0
    ) / (precosNovos.length || 1);

    const margemMediaAtual = precosAtuais.length > 0
      ? precosAtuais.reduce((acc, p) => acc + (p.margem_lucro_percentual || 0), 0) / precosAtuais.length
      : margemMediaNova;

    return {
      totalProdutos: precosNovos.length,
      totalAumentos,
      totalReducoes,
      totalSemAlteracao,
      variacaoMedia,
      maiorAumento,
      maiorReducao,
      topVariacoes,
      margemMediaNova,
      margemMediaAtual,
      variacaoMargem: margemMediaNova - margemMediaAtual,
    };
  }, [precosAtuais, precosNovos]);

  if (!impacto) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum dado de preços para análise
        </CardContent>
      </Card>
    );
  }

  const getVariacaoColor = (variacao: number) => {
    if (variacao > 5) return "text-red-600";
    if (variacao > 0) return "text-orange-600";
    if (variacao < -5) return "text-green-600";
    if (variacao < 0) return "text-blue-600";
    return "text-muted-foreground";
  };

  const getVariacaoIcon = (variacao: number) => {
    if (variacao > 0.5) return <ArrowUp className="h-4 w-4" />;
    if (variacao < -0.5) return <ArrowDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      {/* Resumo do Impacto */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Variação Média</p>
                <p className={`text-xl font-bold ${getVariacaoColor(impacto.variacaoMedia)}`}>
                  {impacto.variacaoMedia > 0 ? '+' : ''}{impacto.variacaoMedia.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Margem Nova</p>
                <p className="text-xl font-bold text-green-600">
                  {impacto.margemMediaNova.toFixed(1)}%
                </p>
                {impacto.variacaoMargem !== 0 && (
                  <span className={`text-xs ${impacto.variacaoMargem > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {impacto.variacaoMargem > 0 ? '+' : ''}{impacto.variacaoMargem.toFixed(1)}pp
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-xs text-muted-foreground">Aumentos</p>
                <p className="text-xl font-bold">{impacto.totalAumentos}</p>
                <p className="text-xs text-muted-foreground">
                  {((impacto.totalAumentos / impacto.totalProdutos) * 100).toFixed(0)}% dos produtos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-cyan-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="text-xs text-muted-foreground">Reduções</p>
                <p className="text-xl font-bold">{impacto.totalReducoes}</p>
                <p className="text-xs text-muted-foreground">
                  {((impacto.totalReducoes / impacto.totalProdutos) * 100).toFixed(0)}% dos produtos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Progresso - Distribuição */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Distribuição das Variações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500" />
                Aumentos ({impacto.totalAumentos})
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gray-400" />
                Sem alteração ({impacto.totalSemAlteracao})
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500" />
                Reduções ({impacto.totalReducoes})
              </span>
            </div>
            <div className="flex h-4 rounded-full overflow-hidden bg-muted">
              <div 
                className="bg-red-500 transition-all" 
                style={{ width: `${(impacto.totalAumentos / impacto.totalProdutos) * 100}%` }}
              />
              <div 
                className="bg-gray-400 transition-all" 
                style={{ width: `${(impacto.totalSemAlteracao / impacto.totalProdutos) * 100}%` }}
              />
              <div 
                className="bg-green-500 transition-all" 
                style={{ width: `${(impacto.totalReducoes / impacto.totalProdutos) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Destaques */}
      <div className="grid gap-3 md:grid-cols-2">
        {impacto.maiorAumento.variacao > 0 && (
          <Card className="border border-red-200 bg-red-50/50 dark:bg-red-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Maior Aumento
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {impacto.maiorAumento.nome}
                  </p>
                  <Badge variant="destructive" className="mt-2">
                    +{impacto.maiorAumento.variacao.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {impacto.maiorReducao.variacao < 0 && (
          <Card className="border border-green-200 bg-green-50/50 dark:bg-green-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Maior Redução
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {impacto.maiorReducao.nome}
                  </p>
                  <Badge className="mt-2 bg-green-600">
                    {impacto.maiorReducao.variacao.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Gráfico de Variações */}
      {impacto.topVariacoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Top 10 Maiores Variações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={impacto.topVariacoes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  type="number" 
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  className="fill-muted-foreground"
                />
                <YAxis 
                  type="category" 
                  dataKey="nome" 
                  width={120}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value > 0 ? '+' : ''}${value.toFixed(2)}%`,
                    'Variação'
                  ]}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
                <Bar 
                  dataKey="variacao" 
                  radius={[0, 4, 4, 0]}
                >
                  {impacto.topVariacoes.map((entry, index) => (
                    <Cell 
                      key={index} 
                      fill={entry.variacao > 0 ? 'hsl(0, 84%, 60%)' : 'hsl(142, 71%, 45%)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
