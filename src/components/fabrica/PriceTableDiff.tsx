import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { ArrowRight, Plus, Minus, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  tabelaId: string;
}

export function PriceTableDiff({ tabelaId }: Props) {
  const { data: versoes, isLoading } = useQuery({
    queryKey: ["price-table-versions", tabelaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco_versoes")
        .select("*")
        .eq("tabela_id", tabelaId)
        .order("versao", { ascending: false })
        .limit(2);

      if (error) throw error;
      return data;
    },
  });

  const { data: precosAtuais } = useQuery({
    queryKey: ["current-prices", tabelaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_precos_produtos")
        .select(`
          *,
          produto:fabrica_produtos(codigo, nome)
        `)
        .eq("tabela_id", tabelaId);

      if (error) throw error;
      return data;
    },
  });

  const { data: auditoria } = useQuery({
    queryKey: ["price-table-audit", tabelaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco_auditoria")
        .select("*")
        .eq("tabela_id", tabelaId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Carregando comparação...</div>;
  }

  const versaoAtual = versoes?.[0];
  const versaoAnterior = versoes?.[1];

  const precosSnapshot = versaoAtual?.precos_snapshot as any[] || [];
  const precosAnteriores = versaoAnterior?.precos_snapshot as any[] || [];

  // Identificar mudanças
  const produtosNovos = precosSnapshot.filter(
    (p) => !precosAnteriores.find((pa) => pa.produto_id === p.produto_id)
  );

  const produtosRemovidos = precosAnteriores.filter(
    (pa) => !precosSnapshot.find((p) => p.produto_id === pa.produto_id)
  );

  const produtosAlterados = precosSnapshot.filter((p) => {
    const anterior = precosAnteriores.find((pa) => pa.produto_id === p.produto_id);
    return anterior && anterior.preco_final !== p.preco_final;
  }).map((p) => ({
    ...p,
    preco_anterior: precosAnteriores.find((pa) => pa.produto_id === p.produto_id)?.preco_final,
  }));

  return (
    <div className="space-y-6">
      {/* Resumo das Mudanças */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo das Alterações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Plus className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold text-green-600">{produtosNovos.length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Produtos Novos</p>
            </div>

            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <ArrowRight className="h-5 w-5 text-yellow-600" />
                <span className="text-2xl font-bold text-yellow-600">{produtosAlterados.length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Preços Alterados</p>
            </div>

            <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Minus className="h-5 w-5 text-red-600" />
                <span className="text-2xl font-bold text-red-600">{produtosRemovidos.length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Produtos Removidos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Produtos Novos */}
      {produtosNovos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-600" />
              Produtos Adicionados ({produtosNovos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {produtosNovos.map((produto) => {
                const produtoInfo = precosAtuais?.find(p => p.produto_id === produto.produto_id);
                return (
                  <div key={produto.produto_id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div>
                      <p className="font-medium">{produtoInfo?.produto?.nome || 'Produto'}</p>
                      <p className="text-sm text-muted-foreground">{produtoInfo?.produto?.codigo}</p>
                    </div>
                    <Badge className="bg-green-600">
                      {formatarMoeda(produto.preco_final)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preços Alterados */}
      {produtosAlterados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-yellow-600" />
              Preços Modificados ({produtosAlterados.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {produtosAlterados.map((produto) => {
                const produtoInfo = precosAtuais?.find(p => p.produto_id === produto.produto_id);
                const diferenca = produto.preco_final - produto.preco_anterior;
                const percentual = ((diferenca / produto.preco_anterior) * 100).toFixed(1);
                
                return (
                  <div key={produto.produto_id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <div>
                      <p className="font-medium">{produtoInfo?.produto?.nome || 'Produto'}</p>
                      <p className="text-sm text-muted-foreground">{produtoInfo?.produto?.codigo}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground line-through">
                            {formatarMoeda(produto.preco_anterior)}
                          </span>
                          <ArrowRight className="h-4 w-4" />
                          <span className="font-semibold">
                            {formatarMoeda(produto.preco_final)}
                          </span>
                        </div>
                        <div className={`text-sm flex items-center gap-1 ${diferenca > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {diferenca > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {diferenca > 0 ? '+' : ''}{percentual}%
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Produtos Removidos */}
      {produtosRemovidos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Minus className="h-5 w-5 text-red-600" />
              Produtos Removidos ({produtosRemovidos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {produtosRemovidos.map((produto) => (
                <div key={produto.produto_id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div>
                    <p className="font-medium line-through">Produto ID: {produto.produto_id}</p>
                  </div>
                  <Badge variant="destructive">
                    Removido
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Auditoria */}
      {auditoria && auditoria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Alterações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {auditoria.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm border-l-2 border-primary pl-3 py-2">
                  <div className="flex-1">
                    <p className="font-medium">{log.mensagem}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Badge variant="outline">{log.acao}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
