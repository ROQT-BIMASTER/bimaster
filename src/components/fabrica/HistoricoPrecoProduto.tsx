import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatarMoeda, formatarPercentual } from "@/lib/fabrica/pricing-calculator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus, History, Calendar, ArrowRight, Calculator, ChevronDown, ChevronRight, Factory, DollarSign, Percent } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoId: string;
  produtoNome?: string;
  tabelaId?: string;
}

interface TabelaPreco {
  id: string;
  nome: string;
  codigo: string;
  tipo_markup: string;
  valor_markup: number;
  tabela_base_id: string | null;
}

interface PrecoTabela {
  tabela_id: string;
  custo_base: number;
  preco_final: number;
  margem_lucro_percentual: number;
}

interface CadeiaCalculo {
  tabela: TabelaPreco;
  custoBase: number;
  precoFinal: number;
  markupAplicado: string;
  valorMarkup: number;
}

export function HistoricoPrecoProduto({ open, onOpenChange, produtoId, produtoNome, tabelaId }: Props) {
  const [periodoFiltro, setPeriodoFiltro] = useState("6m");
  const [cadeiaExpandida, setCadeiaExpandida] = useState(true);

  const getDataInicio = () => {
    const hoje = new Date();
    switch (periodoFiltro) {
      case "1m": return new Date(hoje.setMonth(hoje.getMonth() - 1));
      case "3m": return new Date(hoje.setMonth(hoje.getMonth() - 3));
      case "6m": return new Date(hoje.setMonth(hoje.getMonth() - 6));
      case "1a": return new Date(hoje.setFullYear(hoje.getFullYear() - 1));
      default: return new Date(hoje.setMonth(hoje.getMonth() - 6));
    }
  };

  // Buscar todas as tabelas para montar a cadeia
  const { data: tabelas } = useQuery({
    queryKey: ["tabelas-preco-cadeia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select("id, nome, codigo, tipo_markup, valor_markup, tabela_base_id")
        .eq("ativo", true);

      if (error) throw error;
      return data as TabelaPreco[];
    },
    enabled: open,
  });

  // Buscar todos os preços do produto em todas as tabelas
  const { data: precosProduto } = useQuery({
    queryKey: ["precos-produto-todas-tabelas", produtoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_precos_produtos")
        .select("tabela_id, custo_base, preco_final, margem_lucro_percentual")
        .eq("produto_id", produtoId)
        .eq("ativo", true);

      if (error) throw error;
      return data as PrecoTabela[];
    },
    enabled: open && !!produtoId,
  });

  const { data: historico, isLoading } = useQuery({
    queryKey: ["historico-preco-produto", produtoId, periodoFiltro],
    queryFn: async () => {
      const dataInicio = getDataInicio().toISOString();

      const { data, error } = await supabase
        .from("fabrica_historico_precos")
        .select(`
          *,
          tabela:tabela_id(nome, codigo)
        `)
        .eq("produto_id", produtoId)
        .gte("data_alteracao", dataInicio)
        .order("data_alteracao", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!produtoId,
  });

  // Montar a cadeia de cálculo do preço
  const cadeiaCalculo = (): CadeiaCalculo[] => {
    if (!tabelas || !precosProduto) return [];

    // Encontrar a tabela atual (pela tabelaId passada ou a primeira disponível)
    let tabelaAtualId = tabelaId;
    if (!tabelaAtualId && precosProduto.length > 0) {
      // Pegar a tabela mais "final" (sem ser base de ninguém) ou a primeira
      tabelaAtualId = precosProduto[0].tabela_id;
    }

    if (!tabelaAtualId) return [];

    // Construir a cadeia de trás pra frente (da tabela atual até a origem)
    const cadeia: CadeiaCalculo[] = [];
    let tabelaAtual = tabelas.find(t => t.id === tabelaAtualId);
    
    while (tabelaAtual) {
      const preco = precosProduto.find(p => p.tabela_id === tabelaAtual!.id);
      
      if (preco) {
        let markupDescricao = "";
        switch (tabelaAtual.tipo_markup) {
          case "percentual":
            markupDescricao = `+${tabelaAtual.valor_markup}%`;
            break;
          case "multiplicador":
            markupDescricao = `×${tabelaAtual.valor_markup}`;
            break;
          case "valor_fixo":
            markupDescricao = tabelaAtual.valor_markup > 0 
              ? `+${formatarMoeda(tabelaAtual.valor_markup)}` 
              : "Custo base";
            break;
          default:
            markupDescricao = "-";
        }

        cadeia.unshift({
          tabela: tabelaAtual,
          custoBase: preco.custo_base,
          precoFinal: preco.preco_final,
          markupAplicado: markupDescricao,
          valorMarkup: tabelaAtual.valor_markup,
        });
      }

      // Ir para a tabela base
      if (tabelaAtual.tabela_base_id) {
        tabelaAtual = tabelas.find(t => t.id === tabelaAtual!.tabela_base_id);
      } else {
        tabelaAtual = undefined;
      }
    }

    return cadeia;
  };

  const dadosGrafico = historico?.map((item) => ({
    data: format(new Date(item.data_alteracao), "dd/MM", { locale: ptBR }),
    dataCompleta: format(new Date(item.data_alteracao), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    precoAnterior: item.preco_anterior || 0,
    precoNovo: item.preco_novo || 0,
    tabela: item.tabela?.nome || "N/A",
  })) || [];

  const calcularVariacao = () => {
    if (!historico || historico.length < 2) return null;
    
    const primeiro = historico[0];
    const ultimo = historico[historico.length - 1];
    const precoInicial = primeiro.preco_anterior || primeiro.preco_novo || 0;
    const precoFinal = ultimo.preco_novo || 0;
    
    if (precoInicial === 0) return null;
    
    return ((precoFinal - precoInicial) / precoInicial) * 100;
  };

  const variacao = calcularVariacao();
  const cadeia = cadeiaCalculo();

  const getVariacaoIcon = () => {
    if (!variacao) return <Minus className="h-4 w-4" />;
    if (variacao > 0) return <TrendingUp className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  const getVariacaoColor = () => {
    if (!variacao) return "text-muted-foreground";
    if (variacao > 0) return "text-red-600";
    return "text-green-600";
  };

  const getMarkupIcon = (tipo: string) => {
    switch (tipo) {
      case "percentual":
        return <Percent className="h-4 w-4" />;
      case "multiplicador":
        return <Calculator className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Preços - {produtoNome || "Produto"}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="calculo" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calculo" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Cadeia de Cálculo
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Tab Cadeia de Cálculo */}
          <TabsContent value="calculo" className="space-y-4">
            {cadeia.length > 0 ? (
              <>
                {/* Resumo da Cadeia */}
                <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Factory className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">Custo de Origem</p>
                          <p className="text-xl font-bold">{formatarMoeda(cadeia[0]?.custoBase || 0)}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-6 w-6 text-muted-foreground" />
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">{cadeia.length} etapa(s)</p>
                        <div className="flex items-center gap-1">
                          {cadeia.map((_, i) => (
                            <div key={i} className="w-2 h-2 rounded-full bg-primary" />
                          ))}
                        </div>
                      </div>
                      <ArrowRight className="h-6 w-6 text-muted-foreground" />
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Preço Final</p>
                        <p className="text-xl font-bold text-primary">{formatarMoeda(cadeia[cadeia.length - 1]?.precoFinal || 0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Cadeia Passo a Passo */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Cálculo Passo a Passo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    {cadeia.map((etapa, index) => (
                      <div key={etapa.tabela.id}>
                        {/* Etapa */}
                        <div className={`flex items-center gap-4 p-4 rounded-lg ${index === cadeia.length - 1 ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'}`}>
                          {/* Número da Etapa */}
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${index === cadeia.length - 1 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                            {index + 1}
                          </div>

                          {/* Info da Tabela */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{etapa.tabela.nome}</span>
                              <Badge variant="outline" className="text-xs">
                                {etapa.tabela.codigo}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              {getMarkupIcon(etapa.tabela.tipo_markup)}
                              <span>
                                {index === 0 ? (
                                  "Tabela base (custo de fabricação)"
                                ) : (
                                  <>Markup: <span className="font-medium text-foreground">{etapa.markupAplicado}</span></>
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Valores */}
                          <div className="text-right">
                            {index > 0 && (
                              <div className="text-xs text-muted-foreground mb-1">
                                Base: {formatarMoeda(cadeia[index - 1].precoFinal)}
                              </div>
                            )}
                            <div className={`text-lg font-bold ${index === cadeia.length - 1 ? 'text-primary' : ''}`}>
                              {formatarMoeda(etapa.precoFinal)}
                            </div>
                            {index > 0 && (
                              <div className="text-xs text-green-600">
                                +{formatarMoeda(etapa.precoFinal - cadeia[index - 1].precoFinal)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Seta entre etapas */}
                        {index < cadeia.length - 1 && (
                          <div className="flex justify-center py-2">
                            <div className="flex flex-col items-center gap-1 text-muted-foreground">
                              <div className="w-0.5 h-3 bg-border" />
                              <ChevronDown className="h-4 w-4" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Fórmula de Cálculo */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Fórmula Aplicada</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-muted-foreground">Custo</span>
                        <span className="font-bold">{formatarMoeda(cadeia[0]?.custoBase || 0)}</span>
                        {cadeia.slice(1).map((etapa, i) => (
                          <span key={i} className="flex items-center gap-2">
                            <span className="text-primary">→</span>
                            <span className="text-muted-foreground">{etapa.markupAplicado}</span>
                            <span className="text-muted-foreground">=</span>
                            <span className="font-bold">{formatarMoeda(etapa.precoFinal)}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Margem Final */}
                    <div className="mt-4 flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <span className="text-sm font-medium">Margem de Lucro Total</span>
                      <span className="text-lg font-bold text-green-600">
                        {cadeia[0]?.custoBase && cadeia[cadeia.length - 1]?.precoFinal 
                          ? formatarPercentual(((cadeia[cadeia.length - 1].precoFinal - cadeia[0].custoBase) / cadeia[0].custoBase) * 100)
                          : "-"
                        }
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma informação de cálculo disponível para este produto.</p>
              </div>
            )}
          </TabsContent>

          {/* Tab Histórico */}
          <TabsContent value="historico" className="space-y-4">
            {/* Filtro de Período */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Período:</span>
                <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1m">1 Mês</SelectItem>
                    <SelectItem value="3m">3 Meses</SelectItem>
                    <SelectItem value="6m">6 Meses</SelectItem>
                    <SelectItem value="1a">1 Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {variacao !== null && (
                <Badge variant="outline" className={getVariacaoColor()}>
                  {getVariacaoIcon()}
                  <span className="ml-1">
                    {variacao > 0 ? "+" : ""}{variacao.toFixed(2)}% no período
                  </span>
                </Badge>
              )}
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total de Alterações</p>
                  <p className="text-2xl font-bold">{historico?.length || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Preço Inicial</p>
                  <p className="text-lg font-bold">
                    {historico?.length ? formatarMoeda(historico[0].preco_anterior || historico[0].preco_novo || 0) : "-"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Preço Atual</p>
                  <p className="text-lg font-bold text-primary">
                    {historico?.length ? formatarMoeda(historico[historico.length - 1].preco_novo || 0) : "-"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico */}
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Carregando histórico...
              </div>
            ) : dadosGrafico.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Evolução do Preço</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dadosGrafico}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="data" 
                        tick={{ fontSize: 11 }}
                        className="fill-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => formatarMoeda(v)}
                        className="fill-muted-foreground"
                        width={80}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatarMoeda(value), ""]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload;
                          return `${item?.dataCompleta || label} - ${item?.tabela || ""}`;
                        }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="precoNovo" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        name="Preço"
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground border rounded-lg">
                Nenhum histórico encontrado para este período
              </div>
            )}

            {/* Timeline */}
            {historico && historico.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Alterações Recentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {[...historico].reverse().slice(0, 10).map((item, index) => {
                      const variacao = item.preco_anterior && item.preco_anterior > 0
                        ? ((item.preco_novo - item.preco_anterior) / item.preco_anterior) * 100
                        : 0;
                      
                      return (
                        <div key={item.id || index} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-full ${variacao > 0 ? 'bg-red-100 text-red-600' : variacao < 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                              {variacao > 0 ? <TrendingUp className="h-3 w-3" /> : variacao < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {formatarMoeda(item.preco_anterior || 0)} → {formatarMoeda(item.preco_novo || 0)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.tabela?.nome || "Tabela"} • {format(new Date(item.data_alteracao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          {variacao !== 0 && (
                            <Badge variant={variacao > 0 ? "destructive" : "default"} className={variacao < 0 ? "bg-green-600" : ""}>
                              {variacao > 0 ? "+" : ""}{variacao.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
