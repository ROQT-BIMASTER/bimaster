import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResultadoSimulacao, CenarioSimulacao } from "@/hooks/useSimuladorPrecos";
import { formatarMoeda, formatarPercentual } from "@/lib/fabrica/pricing-calculator";

interface SimuladorComparativoProps {
  resultados: ResultadoSimulacao[];
  cenarioBase: CenarioSimulacao | null;
  cenarioSimulacao: CenarioSimulacao | null;
}

type SortField = 'produto_nome' | 'custo_base' | 'preco_atual' | 'preco_simulado' | 'variacao_percentual' | 'margem_simulada';
type SortDirection = 'asc' | 'desc';

export function SimuladorComparativo({
  resultados,
  cenarioBase,
  cenarioSimulacao,
}: SimuladorComparativoProps) {
  const [busca, setBusca] = useState('');
  const [sortField, setSortField] = useState<SortField>('produto_nome');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const resultadosFiltrados = useMemo(() => {
    let filtered = resultados.filter(r =>
      r.produto_nome.toLowerCase().includes(busca.toLowerCase()) ||
      r.produto_codigo.toLowerCase().includes(busca.toLowerCase())
    );

    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortDirection === 'asc'
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

    return filtered;
  }, [resultados, busca, sortField, sortDirection]);

  // Estatísticas
  const estatisticas = useMemo(() => {
    if (resultados.length === 0) return null;

    const variacaoMedia = resultados.reduce((acc, r) => acc + r.variacao_percentual, 0) / resultados.length;
    const margemMedia = resultados.reduce((acc, r) => acc + r.margem_simulada, 0) / resultados.length;
    const produtosAumentaram = resultados.filter(r => r.variacao_absoluta > 0).length;
    const produtosDiminuiram = resultados.filter(r => r.variacao_absoluta < 0).length;
    const produtosIguais = resultados.filter(r => r.variacao_absoluta === 0).length;

    return {
      variacaoMedia,
      margemMedia,
      produtosAumentaram,
      produtosDiminuiram,
      produtosIguais,
    };
  }, [resultados]);

  const getVariacaoIcon = (variacao: number) => {
    if (variacao > 0) return <TrendingUp className="h-4 w-4 text-success" />;
    if (variacao < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getVariacaoColor = (variacao: number) => {
    if (variacao > 0) return 'text-success';
    if (variacao < 0) return 'text-destructive';
    return 'text-muted-foreground';
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  if (resultados.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Configure os cenários e clique em "Simular Preços" para ver os resultados</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      {estatisticas && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Variação Média</p>
              <p className={`text-2xl font-bold ${getVariacaoColor(estatisticas.variacaoMedia)}`}>
                {estatisticas.variacaoMedia > 0 ? '+' : ''}{formatarPercentual(estatisticas.variacaoMedia)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Margem Média</p>
              <p className="text-2xl font-bold">{formatarPercentual(estatisticas.margemMedia)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Aumentaram</p>
              <p className="text-2xl font-bold text-success">{estatisticas.produtosAumentaram}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Diminuíram</p>
              <p className="text-2xl font-bold text-destructive">{estatisticas.produtosDiminuiram}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Sem Alteração</p>
              <p className="text-2xl font-bold text-muted-foreground">{estatisticas.produtosIguais}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela Comparativa */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Comparativo de Preços</CardTitle>
              <CardDescription>
                {resultadosFiltrados.length} produto{resultadosFiltrados.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton field="produto_nome">Produto</SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="custo_base">Custo Base</SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="preco_atual">Preço Atual</SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="preco_simulado">Preço Simulado</SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="variacao_percentual">Variação</SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton field="margem_simulada">Margem</SortButton>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultadosFiltrados.map((resultado) => (
                  <TableRow key={resultado.produto_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{resultado.produto_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {resultado.produto_codigo}
                          {resultado.categoria && ` • ${resultado.categoria}`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatarMoeda(resultado.custo_base)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {resultado.preco_atual > 0 ? formatarMoeda(resultado.preco_atual) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatarMoeda(resultado.preco_simulado)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {getVariacaoIcon(resultado.variacao_absoluta)}
                        <span className={`font-mono ${getVariacaoColor(resultado.variacao_percentual)}`}>
                          {resultado.variacao_percentual > 0 ? '+' : ''}
                          {formatarPercentual(resultado.variacao_percentual)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        {resultado.variacao_absoluta > 0 ? '+' : ''}
                        {formatarMoeda(resultado.variacao_absoluta)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={resultado.margem_simulada >= 20 ? 'default' : 'secondary'}>
                        {formatarPercentual(resultado.margem_simulada)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
