import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, AlertTriangle, TrendingUp, TrendingDown, Layers } from "lucide-react";
import { ImpactoCadeia } from "@/hooks/useSimuladorPrecos";
import { formatarMoeda, formatarPercentual } from "@/lib/fabrica/pricing-calculator";

interface SimuladorCadeiaImpactoProps {
  impacto: ImpactoCadeia[];
  tabelaSimulada: string;
}

export function SimuladorCadeiaImpacto({ impacto, tabelaSimulada }: SimuladorCadeiaImpactoProps) {
  const totalTabelasAfetadas = useMemo(() => {
    const contarTabelas = (items: ImpactoCadeia[]): number => {
      return items.reduce((acc, item) => acc + 1 + contarTabelas(item.dependentes), 0);
    };
    return contarTabelas(impacto);
  }, [impacto]);

  const renderNodo = (nodo: ImpactoCadeia, nivel: number = 0) => {
    const isPositive = nodo.variacao_percentual > 0;
    const isNegative = nodo.variacao_percentual < 0;

    return (
      <div key={nodo.tabela_id} className="relative">
        {/* Linha conectora */}
        {nivel > 0 && (
          <div className="absolute left-0 top-0 w-8 h-8 border-l-2 border-b-2 border-muted-foreground/30 rounded-bl-lg" />
        )}

        <div className={`flex items-start gap-3 ${nivel > 0 ? 'ml-8' : ''}`}>
          {/* Nodo da tabela */}
          <Card className={`flex-1 border-2 transition-colors ${
            isPositive ? 'border-success/30 bg-success/5' : 
            isNegative ? 'border-destructive/30 bg-destructive/5' : 
            'border-muted'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    isPositive ? 'bg-success/10' : 
                    isNegative ? 'bg-destructive/10' : 
                    'bg-muted'
                  }`}>
                    <Layers className={`h-5 w-5 ${
                      isPositive ? 'text-success' : 
                      isNegative ? 'text-destructive' : 
                      'text-muted-foreground'
                    }`} />
                  </div>
                  <div>
                    <h4 className="font-medium">{nodo.tabela_nome}</h4>
                    <p className="text-sm text-muted-foreground">
                      {nodo.produtos_afetados} produto{nodo.produtos_afetados !== 1 ? 's' : ''} afetado{nodo.produtos_afetados !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="flex items-center gap-2 justify-end">
                    {isPositive && <TrendingUp className="h-4 w-4 text-success" />}
                    {isNegative && <TrendingDown className="h-4 w-4 text-destructive" />}
                    <Badge variant={isPositive ? 'default' : isNegative ? 'destructive' : 'secondary'}>
                      {nodo.variacao_percentual > 0 ? '+' : ''}{formatarPercentual(nodo.variacao_percentual)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span>{formatarMoeda(nodo.preco_medio_atual)}</span>
                    <ArrowRight className="inline-block h-3 w-3 mx-1" />
                    <span className="font-medium">{formatarMoeda(nodo.preco_medio_simulado)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dependentes */}
        {nodo.dependentes.length > 0 && (
          <div className="mt-3 space-y-3">
            {nodo.dependentes.map(dep => renderNodo(dep, nivel + 1))}
          </div>
        )}
      </div>
    );
  };

  if (impacto.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Impacto na Cadeia de Preços
          </CardTitle>
          <CardDescription>
            Visualização do efeito cascata nas tabelas dependentes
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Layers className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            Nenhuma tabela dependente encontrada
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            A tabela selecionada não possui outras tabelas que dependem dela
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div>
              <p className="font-medium">Atenção: {totalTabelasAfetadas} tabela{totalTabelasAfetadas !== 1 ? 's' : ''} será{totalTabelasAfetadas !== 1 ? 'ão' : ''} impactada{totalTabelasAfetadas !== 1 ? 's' : ''}</p>
              <p className="text-sm text-muted-foreground">
                As alterações simuladas afetarão as tabelas abaixo quando aplicadas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Árvore de Impacto */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Cadeia de Impacto
          </CardTitle>
          <CardDescription>
            Propagação do reajuste através das tabelas dependentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {impacto.map(nodo => renderNodo(nodo))}
          </div>
        </CardContent>
      </Card>

      {/* Legenda */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span>Aumento de preço</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span>Redução de preço</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted-foreground" />
              <span>Sem alteração</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
