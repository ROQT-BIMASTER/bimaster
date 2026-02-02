import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { ResultadoSimulacao } from "@/hooks/useSimuladorPrecos";

interface SimuladorGraficosProps {
  resultados: ResultadoSimulacao[];
}

export function SimuladorGraficos({ resultados }: SimuladorGraficosProps) {
  // Dados para gráfico de variação por categoria
  const dadosPorCategoria = useMemo(() => {
    const categorias: Record<string, { soma: number; count: number }> = {};
    
    resultados.forEach(r => {
      const cat = r.categoria || 'Sem categoria';
      if (!categorias[cat]) {
        categorias[cat] = { soma: 0, count: 0 };
      }
      categorias[cat].soma += r.variacao_percentual;
      categorias[cat].count += 1;
    });

    return Object.entries(categorias)
      .map(([nome, dados]) => ({
        nome: nome.length > 20 ? nome.substring(0, 20) + '...' : nome,
        variacao: dados.soma / dados.count,
        produtos: dados.count,
      }))
      .sort((a, b) => b.variacao - a.variacao);
  }, [resultados]);

  // Dados para distribuição de margens
  const distribuicaoMargens = useMemo(() => {
    const faixas = [
      { faixa: '< 10%', min: -Infinity, max: 10, count: 0 },
      { faixa: '10-20%', min: 10, max: 20, count: 0 },
      { faixa: '20-30%', min: 20, max: 30, count: 0 },
      { faixa: '30-40%', min: 30, max: 40, count: 0 },
      { faixa: '> 40%', min: 40, max: Infinity, count: 0 },
    ];

    resultados.forEach(r => {
      const faixa = faixas.find(f => r.margem_simulada >= f.min && r.margem_simulada < f.max);
      if (faixa) faixa.count += 1;
    });

    return faixas.filter(f => f.count > 0);
  }, [resultados]);

  // Dados para variação (aumentos vs diminuições)
  const dadosVariacao = useMemo(() => {
    const aumentos = resultados.filter(r => r.variacao_absoluta > 0).length;
    const diminuicoes = resultados.filter(r => r.variacao_absoluta < 0).length;
    const iguais = resultados.filter(r => r.variacao_absoluta === 0).length;

    return [
      { nome: 'Aumentaram', valor: aumentos, cor: 'hsl(var(--success))' },
      { nome: 'Diminuíram', valor: diminuicoes, cor: 'hsl(var(--destructive))' },
      { nome: 'Sem alteração', valor: iguais, cor: 'hsl(var(--muted))' },
    ].filter(d => d.valor > 0);
  }, [resultados]);

  // Top 10 maiores variações
  const maioresVariacoes = useMemo(() => {
    return [...resultados]
      .sort((a, b) => Math.abs(b.variacao_percentual) - Math.abs(a.variacao_percentual))
      .slice(0, 10)
      .map(r => ({
        nome: r.produto_nome.length > 25 ? r.produto_nome.substring(0, 25) + '...' : r.produto_nome,
        variacao: r.variacao_percentual,
      }));
  }, [resultados]);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--muted))'];

  if (resultados.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Configure os cenários para ver os gráficos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Variação por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Variação Média por Categoria</CardTitle>
          <CardDescription>Impacto percentual médio em cada grupo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosPorCategoria} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                <XAxis type="number" tickFormatter={(v) => `${v.toFixed(1)}%`} />
                <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Variação']}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="variacao" radius={[0, 4, 4, 0]}>
                  {dadosPorCategoria.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.variacao >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Distribuição de Margens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Distribuição de Margens</CardTitle>
          <CardDescription>Quantidade de produtos por faixa de margem simulada</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribuicaoMargens} margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="faixa" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip
                  formatter={(value: number) => [value, 'Produtos']}
                  labelFormatter={(label) => `Margem: ${label}`}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                  {distribuicaoMargens.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Resumo de Variações (Pie Chart) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo de Variações</CardTitle>
          <CardDescription>Proporção de produtos por tipo de variação</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dadosVariacao}
                  dataKey="valor"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ nome, valor }) => `${nome}: ${valor}`}
                >
                  {dadosVariacao.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cor} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top 10 Maiores Variações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 10 Maiores Variações</CardTitle>
          <CardDescription>Produtos com maior impacto de preço (positivo ou negativo)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maioresVariacoes} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                <XAxis type="number" tickFormatter={(v) => `${v.toFixed(1)}%`} />
                <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Variação']}
                />
                <Bar dataKey="variacao" radius={[0, 4, 4, 0]}>
                  {maioresVariacoes.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.variacao >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
