import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Save, AlertTriangle, Shield, X, Filter, ChevronDown, ChevronRight, TableIcon, Calculator, TrendingDown, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatarMoeda, simularCalculoReverso, SimulacaoPrecoReverso } from "@/lib/fabrica/pricing-calculator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TabelaPreco {
  id: string;
  nome: string;
  status: string | null;
  ordem: number;
}

interface ProdutoComLimites {
  id: string;
  codigo: string;
  nome: string;
  linha: string | null;
  categoria: string | null;
  preco_maximo: number | null;
  preco_minimo: number | null;
  preco_atual?: number | null;
}

interface SimulacaoState {
  produtoId: string;
  produtoNome: string;
  precoDesejado: number;
  tabelaOrigemId: string;
  resultados: SimulacaoPrecoReverso[];
  carregando: boolean;
}

export function GerenciarLimitesPrecoDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tabelaSelecionada, setTabelaSelecionada] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("all");
  const [limitesEditados, setLimitesEditados] = useState<Record<string, { preco_maximo: string; preco_minimo: string }>>({});
  const [produtosAlterados, setProdutosAlterados] = useState<Set<string>>(new Set());
  const [categoriasAbertas, setCategoriasAbertas] = useState<Set<string>>(new Set());
  const [simulacao, setSimulacao] = useState<SimulacaoState | null>(null);
  const [tabelaSimulacaoOrigem, setTabelaSimulacaoOrigem] = useState<string>("");

  // Buscar tabelas de preço
  const { data: tabelas, isLoading: isLoadingTabelas } = useQuery({
    queryKey: ['fabrica-tabelas-limites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabrica_tabelas_preco')
        .select('id, nome, status, ordem')
        .order('ordem');

      if (error) throw error;
      return data as TabelaPreco[];
    },
    enabled: open,
  });

  // Tabelas anteriores à selecionada (para o select de simulação)
  const tabelasAnteriores = useMemo(() => {
    if (!tabelas || !tabelaSelecionada) return [];
    const tabelaAtual = tabelas.find(t => t.id === tabelaSelecionada);
    if (!tabelaAtual) return [];
    return tabelas.filter(t => t.ordem < tabelaAtual.ordem);
  }, [tabelas, tabelaSelecionada]);

  // Buscar produtos acabados com limites - corrigido para ACABADO maiúsculo e também incluir acabado minúsculo
  const { data: produtos, isLoading } = useQuery({
    queryKey: ['fabrica-produtos-limites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fabrica_produtos')
        .select(`
          id,
          codigo,
          nome,
          linha,
          categoria,
          preco_maximo,
          preco_minimo
        `)
        .eq('ativo', true)
        .or('tipo.eq.ACABADO,tipo.eq.acabado')
        .order('categoria', { ascending: true, nullsFirst: false })
        .order('nome');

      if (error) throw error;
      return data as ProdutoComLimites[];
    },
    enabled: open,
  });

  // Buscar preços atuais dos produtos da tabela selecionada
  const { data: precosAtuais } = useQuery({
    queryKey: ['fabrica-precos-atuais', tabelaSelecionada],
    queryFn: async () => {
      if (!tabelaSelecionada) return {};
      
      const { data, error } = await supabase
        .from('fabrica_precos_produtos')
        .select('produto_id, preco_final')
        .eq('tabela_id', tabelaSelecionada)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Agrupar por produto, pegando o mais recente
      const precosPorProduto: Record<string, number> = {};
      data?.forEach(p => {
        if (!precosPorProduto[p.produto_id]) {
          precosPorProduto[p.produto_id] = Number(p.preco_final);
        }
      });
      return precosPorProduto;
    },
    enabled: open && !!tabelaSelecionada,
  });

  // Buscar categorias únicas para filtro
  const categorias = useMemo(() => {
    return [...new Set(produtos?.map(p => p.categoria || "Sem Categoria"))].sort();
  }, [produtos]);

  // Agrupar produtos por categoria
  const produtosAgrupados = useMemo(() => {
    if (!produtos) return new Map<string, ProdutoComLimites[]>();
    
    const grupos = new Map<string, ProdutoComLimites[]>();
    produtos.forEach(p => {
      const cat = p.categoria || "Sem Categoria";
      if (!grupos.has(cat)) grupos.set(cat, []);
      grupos.get(cat)!.push(p);
    });
    
    return grupos;
  }, [produtos]);

  // Inicializar limites editados quando produtos carregam
  useEffect(() => {
    if (produtos && Object.keys(limitesEditados).length === 0) {
      const limites: Record<string, { preco_maximo: string; preco_minimo: string }> = {};
      produtos.forEach(p => {
        limites[p.id] = {
          preco_maximo: p.preco_maximo?.toString() || "",
          preco_minimo: p.preco_minimo?.toString() || "",
        };
      });
      setLimitesEditados(limites);
    }
  }, [produtos]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setLimitesEditados({});
      setProdutosAlterados(new Set());
      setBusca("");
      setCategoriaFiltro("all");
      setCategoriasAbertas(new Set());
      setTabelaSelecionada("");
      setSimulacao(null);
      setTabelaSimulacaoOrigem("");
    }
  }, [open]);

  // Abrir todas categorias por padrão ao carregar
  useEffect(() => {
    if (produtos && categoriasAbertas.size === 0) {
      setCategoriasAbertas(new Set(categorias));
    }
  }, [categorias, produtos]);

  // Mutation para salvar limites
  const salvarMutation = useMutation({
    mutationFn: async () => {
      const updates = Array.from(produtosAlterados).map(produtoId => {
        const limite = limitesEditados[produtoId];
        return {
          id: produtoId,
          preco_maximo: limite.preco_maximo ? parseFloat(limite.preco_maximo) : null,
          preco_minimo: limite.preco_minimo ? parseFloat(limite.preco_minimo) : null,
        };
      });

      for (const update of updates) {
        const { error } = await supabase
          .from('fabrica_produtos')
          .update({
            preco_maximo: update.preco_maximo,
            preco_minimo: update.preco_minimo,
          })
          .eq('id', update.id);

        if (error) throw error;
      }

      // Registrar auditoria
      await supabase.from('audit_logs').insert({
        action: 'UPDATE_LIMITES_PRECO',
        entity_type: 'fabrica_produtos',
        metadata: { produtos_atualizados: updates.length },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fabrica-produtos-limites'] });
      queryClient.invalidateQueries({ queryKey: ['fabrica-produtos'] });
      toast({ title: "Limites salvos", description: `${produtosAlterados.size} produto(s) atualizado(s)` });
      setProdutosAlterados(new Set());
    },
    onError: (error: any) => {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    },
  });

  const handleLimiteChange = (produtoId: string, campo: 'preco_maximo' | 'preco_minimo', valor: string) => {
    // Permitir apenas números e ponto
    const valorLimpo = valor.replace(/[^\d.]/g, '');
    
    setLimitesEditados(prev => ({
      ...prev,
      [produtoId]: {
        ...prev[produtoId],
        [campo]: valorLimpo,
      },
    }));
    
    setProdutosAlterados(prev => new Set(prev).add(produtoId));
  };

  const limparLimite = (produtoId: string) => {
    setLimitesEditados(prev => ({
      ...prev,
      [produtoId]: { preco_maximo: "", preco_minimo: "" },
    }));
    setProdutosAlterados(prev => new Set(prev).add(produtoId));
  };

  // Executar simulação de cálculo reverso
  const executarSimulacao = async (produtoId: string, produtoNome: string, precoMaximo: number) => {
    if (!tabelaSelecionada || !tabelaSimulacaoOrigem || precoMaximo <= 0) {
      toast({ title: "Selecione a tabela de origem para simulação", variant: "destructive" });
      return;
    }

    setSimulacao({
      produtoId,
      produtoNome,
      precoDesejado: precoMaximo,
      tabelaOrigemId: tabelaSimulacaoOrigem,
      resultados: [],
      carregando: true,
    });

    try {
      const resultados = await simularCalculoReverso(
        tabelaSelecionada,
        tabelaSimulacaoOrigem,
        produtoId,
        precoMaximo
      );

      setSimulacao(prev => prev ? { ...prev, resultados, carregando: false } : null);
    } catch (error) {
      toast({ title: "Erro ao simular", description: "Não foi possível calcular a simulação", variant: "destructive" });
      setSimulacao(null);
    }
  };

  // Fechar painel de simulação
  const fecharSimulacao = () => {
    setSimulacao(null);
  };

  // Filtrar produtos
  const produtosFiltrados = useMemo(() => {
    return produtos?.filter(p => {
      const matchBusca = !busca || 
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busca.toLowerCase());
      const matchCategoria = categoriaFiltro === "all" || (p.categoria || "Sem Categoria") === categoriaFiltro;
      return matchBusca && matchCategoria;
    });
  }, [produtos, busca, categoriaFiltro]);

  // Agrupar produtos filtrados por categoria
  const produtosFiltradosAgrupados = useMemo(() => {
    if (!produtosFiltrados) return new Map<string, ProdutoComLimites[]>();
    
    const grupos = new Map<string, ProdutoComLimites[]>();
    produtosFiltrados.forEach(p => {
      const cat = p.categoria || "Sem Categoria";
      if (!grupos.has(cat)) grupos.set(cat, []);
      grupos.get(cat)!.push(p);
    });
    
    return grupos;
  }, [produtosFiltrados]);

  const toggleCategoria = (categoria: string) => {
    setCategoriasAbertas(prev => {
      const novo = new Set(prev);
      if (novo.has(categoria)) {
        novo.delete(categoria);
      } else {
        novo.add(categoria);
      }
      return novo;
    });
  };

  // Verificar se preço atual excede limite
  const verificarExcedeLimite = (produtoId: string) => {
    const precoAtual = precosAtuais?.[produtoId];
    const limiteMax = limitesEditados[produtoId]?.preco_maximo;
    
    if (precoAtual && limiteMax) {
      return precoAtual > parseFloat(limiteMax);
    }
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Gerenciar Limites de Preço
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seletor de Tabela de Preços */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              Selecione a Tabela de Preços
            </label>
            <Select value={tabelaSelecionada} onValueChange={setTabelaSelecionada}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Escolha uma tabela de preços..." />
              </SelectTrigger>
              <SelectContent>
                {isLoadingTabelas ? (
                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                ) : (
                  tabelas?.map(tabela => (
                    <SelectItem key={tabela.id} value={tabela.id}>
                      {tabela.nome} {tabela.status === 'ativa' && <Badge variant="outline" className="ml-2">Ativa</Badge>}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {!tabelaSelecionada ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground border rounded-lg">
              Selecione uma tabela de preços para gerenciar os limites
            </div>
          ) : (
            <>
              {/* Filtros */}
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                  <SelectTrigger className="w-[200px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categorias.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Info */}
              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Defina limites de preço máximo e mínimo para cada produto. 
                  Ao gerar preços, valores que excedam esses limites serão automaticamente ajustados.
                </p>
              </div>

              {/* Seletor de tabela para simulação */}
              {tabelasAnteriores.length > 0 && (
                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Simulação de Cálculo Reverso</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Simule ajustes necessários nas tabelas anteriores para atingir o preço limite</p>
                  </div>
                  <Select value={tabelaSimulacaoOrigem} onValueChange={setTabelaSimulacaoOrigem}>
                    <SelectTrigger className="w-[200px] bg-background">
                      <SelectValue placeholder="Simular a partir de..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tabelasAnteriores.map(tabela => (
                        <SelectItem key={tabela.id} value={tabela.id}>
                          {tabela.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Painel de Simulação */}
              {simulacao && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-blue-600" />
                        Simulação para: {simulacao.produtoNome}
                      </CardTitle>
                      <Button variant="ghost" size="icon" onClick={fecharSimulacao}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Para atingir {formatarMoeda(simulacao.precoDesejado)} na tabela selecionada
                    </p>
                  </CardHeader>
                  <CardContent>
                    {simulacao.carregando ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="ml-2 text-sm">Calculando...</span>
                      </div>
                    ) : simulacao.resultados.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Não foi possível calcular a simulação. Verifique se existem preços cadastrados.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tabela</TableHead>
                              <TableHead className="text-right">Preço Atual</TableHead>
                              <TableHead className="text-center"><ArrowRight className="h-4 w-4 mx-auto" /></TableHead>
                              <TableHead className="text-right">Preço Sugerido</TableHead>
                              <TableHead className="text-right">Diferença</TableHead>
                              <TableHead className="text-right">Margem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {simulacao.resultados.map((resultado, index) => (
                              <TableRow key={resultado.tabela_id}>
                                <TableCell className="font-medium">{resultado.tabela_nome}</TableCell>
                                <TableCell className="text-right">{formatarMoeda(resultado.preco_atual)}</TableCell>
                                <TableCell className="text-center">
                                  <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                                </TableCell>
                                <TableCell className="text-right font-medium text-blue-600">
                                  {formatarMoeda(resultado.preco_sugerido)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={`flex items-center justify-end gap-1 ${resultado.diferenca_percentual < 0 ? 'text-red-600' : resultado.diferenca_percentual > 0 ? 'text-green-600' : ''}`}>
                                    {resultado.diferenca_percentual < 0 ? (
                                      <TrendingDown className="h-3 w-3" />
                                    ) : resultado.diferenca_percentual > 0 ? (
                                      <TrendingUp className="h-3 w-3" />
                                    ) : null}
                                    {resultado.diferenca_percentual.toFixed(1)}%
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={resultado.margem_resultante < 0 ? 'text-red-600 font-medium' : ''}>
                                    {resultado.margem_resultante.toFixed(1)}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {simulacao.resultados.some(r => r.margem_resultante < 0) && (
                          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 p-2 rounded">
                            <AlertTriangle className="h-4 w-4" />
                            Atenção: Algumas tabelas teriam margem negativa com esses ajustes
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Tabela agrupada por categoria */}
              <ScrollArea className="h-[380px] border rounded-lg">
                {isLoading ? (
                  <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : produtosFiltrados?.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                Nenhum produto encontrado
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {Array.from(produtosFiltradosAgrupados.entries()).map(([categoria, produtosCategoria]) => (
                  <Collapsible 
                    key={categoria} 
                    open={categoriasAbertas.has(categoria)}
                    onOpenChange={() => toggleCategoria(categoria)}
                  >
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      {categoriasAbertas.has(categoria) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{categoria}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {produtosCategoria.length} produto(s)
                      </Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">Código</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead className="w-[100px]">Linha</TableHead>
                            <TableHead className="w-[110px]">Preço Atual</TableHead>
                            <TableHead className="w-[110px] text-center">Mínimo (R$)</TableHead>
                            <TableHead className="w-[110px] text-center">Máximo (R$)</TableHead>
                            <TableHead className="w-[80px] text-center">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {produtosCategoria.map((produto) => {
                            const excedeLimite = verificarExcedeLimite(produto.id);
                            const alterado = produtosAlterados.has(produto.id);
                            
                            return (
                              <TableRow 
                                key={produto.id} 
                                className={alterado ? "bg-primary/5" : excedeLimite ? "bg-destructive/5" : ""}
                              >
                                <TableCell className="font-mono text-sm">{produto.codigo}</TableCell>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {produto.nome}
                                    {excedeLimite && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <AlertTriangle className="h-4 w-4 text-destructive" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Preço atual excede o limite máximo
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {produto.linha && <Badge variant="outline" className="text-xs">{produto.linha}</Badge>}
                                </TableCell>
                                <TableCell>
                                  {precosAtuais?.[produto.id] 
                                    ? formatarMoeda(precosAtuais[produto.id])
                                    : <span className="text-muted-foreground">-</span>
                                  }
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    value={limitesEditados[produto.id]?.preco_minimo || ""}
                                    onChange={(e) => handleLimiteChange(produto.id, 'preco_minimo', e.target.value)}
                                    className="w-24 text-center"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0,00"
                                    value={limitesEditados[produto.id]?.preco_maximo || ""}
                                    onChange={(e) => handleLimiteChange(produto.id, 'preco_maximo', e.target.value)}
                                    className="w-24 text-center"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {limitesEditados[produto.id]?.preco_maximo && tabelaSimulacaoOrigem && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => executarSimulacao(
                                                produto.id, 
                                                produto.nome, 
                                                parseFloat(limitesEditados[produto.id].preco_maximo)
                                              )}
                                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                            >
                                              <Calculator className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Simular ajustes para atingir este limite
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    {(limitesEditados[produto.id]?.preco_maximo || limitesEditados[produto.id]?.preco_minimo) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => limparLimite(produto.id)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
                )}
              </ScrollArea>

              {/* Resumo */}
              {produtosAlterados.size > 0 && (
                <div className="flex items-center justify-between bg-primary/10 p-3 rounded-lg">
                  <span className="text-sm font-medium">
                    {produtosAlterados.size} produto(s) com alterações pendentes
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setProdutosAlterados(new Set());
                      // Reinicializar limites
                      if (produtos) {
                        const limites: Record<string, { preco_maximo: string; preco_minimo: string }> = {};
                        produtos.forEach(p => {
                          limites[p.id] = {
                            preco_maximo: p.preco_maximo?.toString() || "",
                            preco_minimo: p.preco_minimo?.toString() || "",
                          };
                        });
                        setLimitesEditados(limites);
                      }
                    }}
                  >
                    Desfazer alterações
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => salvarMutation.mutate()}
            disabled={produtosAlterados.size === 0 || salvarMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {salvarMutation.isPending ? "Salvando..." : "Salvar Limites"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
