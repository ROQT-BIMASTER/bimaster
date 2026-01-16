import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { calcularPrecosProdutos, formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { Loader2, CheckCircle2, Factory, Ship } from "lucide-react";

interface ProdutoData {
  id: string;
  codigo: string | null;
  nome: string;
  origem: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabela: any;
  onSuccess: () => void;
}

export function GeradorPrecosDialog({ open, onOpenChange, tabela, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [fonteCusto, setFonteCusto] = useState<"ordem_producao" | "custo_medio" | "manual" | "tabela_anterior" | "custo_origem">("ordem_producao");
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [produtosNaTabelaBase, setProdutosNaTabelaBase] = useState<string[]>([]);
  const [custosManual, setCustosManual] = useState<Record<string, string>>({});
  const [precosCalculados, setPrecosCalculados] = useState<any[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoData[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState("");
  const [origemSelecionada, setOrigemSelecionada] = useState<'nacional' | 'importado' | null>(null);

  useEffect(() => {
    if (open && tabela) {
      loadProdutos();
      loadProdutosTabela();
      
      // Definir origem baseado na tabela
      if (tabela.origem_aplicavel === 'nacional') {
        setOrigemSelecionada('nacional');
      } else if (tabela.origem_aplicavel === 'importado') {
        setOrigemSelecionada('importado');
      } else {
        setOrigemSelecionada(null);
      }
    } else if (!open) {
      // Reset state quando fechar o dialog
      setProdutosSelecionados([]);
      setProdutosNaTabelaBase([]);
      setPrecosCalculados([]);
      setCustosManual({});
      setBuscaProduto("");
      setOrigemSelecionada(null);
    }
  }, [open, tabela]);

  const loadProdutos = async () => {
    setLoadingProdutos(true);
    try {
      // Buscar apenas produtos acabados finalizados
      let query = supabase
        .from("fabrica_produtos")
        .select("id, codigo, nome, origem")
        .eq("tipo", "ACABADO")
        .eq("ativo", true);

      // Filtrar por origem se a tabela especificar
      if (tabela?.origem_aplicavel && tabela.origem_aplicavel !== 'ambos') {
        query = query.eq("origem", tabela.origem_aplicavel);
      }

      const response = await query.order("nome");

      if (response.error) throw response.error;
      setProdutos(response.data || []);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoadingProdutos(false);
    }
  };

  const loadProdutosTabela = async () => {
    try {
      // Se usar tabela anterior como base, carregar produtos da tabela base
      if (tabela?.tipo_base === "tabela_anterior" && tabela?.tabela_base_id) {
        const { data, error } = await supabase
          .from("fabrica_precos_produtos")
          .select("produto_id")
          .eq("tabela_id", tabela.tabela_base_id)
          .eq("ativo", true);

        if (error) throw error;
        
        // Pré-selecionar produtos que já existem na tabela base
        if (data && data.length > 0) {
          const produtosIds = data.map(p => p.produto_id);
          setProdutosSelecionados(produtosIds);
          setProdutosNaTabelaBase(produtosIds);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar produtos da tabela:", error);
    }
  };

  useEffect(() => {
    if (tabela?.tipo_base === "tabela_anterior") {
      setFonteCusto("tabela_anterior");
    } else if (origemSelecionada) {
      setFonteCusto("custo_origem");
    }
  }, [tabela, origemSelecionada]);

  const calcularPrecosMutation = useMutation({
    mutationFn: async () => {
      setCalculando(true);
      const precos = await calcularPrecosProdutos(
        tabela.id,
        produtosSelecionados,
        {
          fonteCusto,
          custosManual: Object.fromEntries(
            Object.entries(custosManual).map(([id, valor]) => [id, parseFloat(valor)])
          ),
          origem: origemSelecionada || undefined,
        }
      );

      return precos;
    },
    onSuccess: (precos) => {
      setPrecosCalculados(precos);
      setCalculando(false);
      toast.success("Preços calculados com sucesso!");
    },
    onError: (error: any) => {
      setCalculando(false);
      toast.error("Erro ao calcular preços: " + error.message);
    },
  });

  const salvarPrecosMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      
      if (!precosCalculados || precosCalculados.length === 0) {
        throw new Error("Nenhum preço calculado para salvar");
      }
      
      const registros = precosCalculados.map((preco) => ({
        tabela_id: tabela.id,
        produto_id: preco.produto_id,
        custo_base: preco.custo_base,
        custo_base_origem: fonteCusto,
        preco_calculado: preco.preco_calculado,
        preco_final: preco.preco_final,
        margem_lucro_percentual: preco.margem_lucro_percentual,
        origem: origemSelecionada || 'nacional',
        ativo: true,
      }));

      const { error } = await supabase
        .from("fabrica_precos_produtos")
        .upsert(registros, {
          onConflict: "tabela_id,produto_id",
        });

      if (error) throw error;

      // (Versões são criadas automaticamente por trigger ao mudar status para pending_approval)

      // SEMPRE atualizar para pending_approval e ativar
      const { error: statusError } = await supabase
        .from("fabrica_tabelas_preco")
        .update({ 
          status: 'pending_approval',
          ativo: true
        })
        .eq("id", tabela.id);

      if (statusError) {
        console.error("Erro ao atualizar status:", statusError);
        throw statusError;
      }

      // Registrar na auditoria
      const { error: auditoriaError } = await supabase
        .from("fabrica_tabelas_preco_auditoria")
        .insert({
          tabela_id: tabela.id,
          user_id: user.user?.id,
          acao: "price_generation",
          mensagem: `Preços gerados - enviados para aprovação`,
        });

      if (auditoriaError) {
        console.error("Erro na auditoria:", auditoriaError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tabelas-preco"] });
      queryClient.invalidateQueries({ queryKey: ["visualizacao-precos"] });
      queryClient.invalidateQueries({ queryKey: ["tabelas-pendentes-aprovacao"] });
      queryClient.invalidateQueries({ queryKey: ["fabrica-tabelas-preco"] });
      toast.success("Preços salvos e enviados para aprovação!");
      onSuccess();
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar preços: " + error.message);
    },
  });

  const handleSelecionarTodos = (checked: boolean) => {
    if (checked) {
      setProdutosSelecionados(produtosFiltrados.map(p => p.id));
    } else {
      setProdutosSelecionados([]);
    }
  };

  const handleToggleProduto = (produtoId: string, checked: boolean) => {
    if (checked) {
      setProdutosSelecionados([...produtosSelecionados, produtoId]);
    } else {
      setProdutosSelecionados(produtosSelecionados.filter(id => id !== produtoId));
    }
  };

  const handleCalcular = () => {
    if (produtosSelecionados.length === 0) {
      toast.error("Selecione pelo menos um produto");
      return;
    }

    if (fonteCusto === "manual") {
      const faltamCustos = produtosSelecionados.some(id => !custosManual[id] || parseFloat(custosManual[id]) <= 0);
      if (faltamCustos) {
        toast.error("Preencha o custo manual de todos os produtos selecionados");
        return;
      }
    }

    calcularPrecosMutation.mutate();
  };

  const getTipoMarkupLabel = () => {
    if (!tabela) return "";
    
    switch (tabela.tipo_markup) {
      case 'percentual':
        return `+${tabela.valor_markup}%`;
      case 'multiplicador':
        return `x${tabela.valor_markup}`;
      case 'valor_fixo':
        return `+${formatarMoeda(tabela.valor_markup)}`;
      default:
        return tabela.valor_markup.toString();
    }
  };

  const produtosFiltrados = produtos?.filter(produto => {
    if (!buscaProduto) return true;
    const busca = buscaProduto.toLowerCase();
    return (
      produto.nome.toLowerCase().includes(busca) ||
      produto.codigo?.toLowerCase().includes(busca)
    );
  }) || [];

  if (!tabela) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Preços - {tabela.nome}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Markup: {getTipoMarkupLabel()}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Indicador de Origem da Tabela */}
          {tabela.origem_aplicavel && tabela.origem_aplicavel !== 'ambos' && (
            <div className={`p-3 rounded-lg border flex items-center gap-2 ${
              tabela.origem_aplicavel === 'nacional' 
                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
            }`}>
              {tabela.origem_aplicavel === 'nacional' ? (
                <Factory className="h-5 w-5 text-green-600" />
              ) : (
                <Ship className="h-5 w-5 text-blue-600" />
              )}
              <span className="text-sm font-medium">
                Esta tabela é exclusiva para produtos de origem <strong>{tabela.origem_aplicavel === 'nacional' ? 'Nacional' : 'Importada'}</strong>
              </span>
            </div>
          )}

          {/* Fonte do Custo */}
          {tabela.tipo_base !== "tabela_anterior" && (
            <div>
              <Label>Fonte do Custo Base</Label>
              <RadioGroup value={fonteCusto} onValueChange={(value: any) => setFonteCusto(value)}>
                {origemSelecionada && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custo_origem" id="fonte_origem" />
                    <Label htmlFor="fonte_origem" className="font-normal cursor-pointer flex items-center gap-2">
                      {origemSelecionada === 'nacional' ? <Factory className="h-4 w-4 text-green-600" /> : <Ship className="h-4 w-4 text-blue-600" />}
                      Custo por Origem ({origemSelecionada === 'nacional' ? 'Nacional' : 'Importado'})
                    </Label>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ordem_producao" id="fonte_op" />
                  <Label htmlFor="fonte_op" className="font-normal cursor-pointer">
                    Última Ordem de Produção
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custo_medio" id="fonte_medio" />
                  <Label htmlFor="fonte_medio" className="font-normal cursor-pointer">
                    Custo Médio do Produto
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="fonte_manual" />
                  <Label htmlFor="fonte_manual" className="font-normal cursor-pointer">
                    Digitar Manualmente
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Lista de Produtos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Produtos</Label>
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Buscar produto..."
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                  className="w-64"
                />
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="selecionar_todos"
                    checked={produtosSelecionados.length === produtosFiltrados.length && produtosFiltrados.length > 0}
                    onCheckedChange={handleSelecionarTodos}
                  />
                  <Label htmlFor="selecionar_todos" className="font-normal cursor-pointer whitespace-nowrap">
                    Selecionar todos
                  </Label>
                </div>
              </div>
            </div>

            {produtosNaTabelaBase.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>{produtosNaTabelaBase.length} produto(s)</strong> já existem na tabela base e foram pré-selecionados. 
                  Você pode adicionar ou remover produtos conforme necessário.
                </p>
              </div>
            )}

            {loadingProdutos ? (
              <div className="text-center py-4 text-muted-foreground">Carregando produtos...</div>
            ) : (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left w-12"></th>
                      <th className="p-2 text-left">Produto</th>
                      {fonteCusto === "manual" && (
                        <th className="p-2 text-left w-32">Custo Base (R$)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {produtosFiltrados.map((produto) => (
                      <tr key={produto.id} className="border-t">
                        <td className="p-2">
                          <Checkbox
                            checked={produtosSelecionados.includes(produto.id)}
                            onCheckedChange={(checked) => handleToggleProduto(produto.id, checked as boolean)}
                          />
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="font-medium">{produto.nome}</div>
                              <div className="text-sm text-muted-foreground">{produto.codigo}</div>
                            </div>
                            {produto.origem && (
                              <Badge variant="outline" className={`flex items-center gap-1 ${
                                produto.origem === 'nacional' ? 'border-green-300 text-green-700' : 'border-blue-300 text-blue-700'
                              }`}>
                                {produto.origem === 'nacional' ? <Factory className="h-3 w-3" /> : <Ship className="h-3 w-3" />}
                                {produto.origem === 'nacional' ? 'Nac' : 'Imp'}
                              </Badge>
                            )}
                            {produtosNaTabelaBase.includes(produto.id) && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Na tabela base
                              </Badge>
                            )}
                          </div>
                        </td>
                        {fonteCusto === "manual" && (
                          <td className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={custosManual[produto.id] || ""}
                              onChange={(e) =>
                                setCustosManual({ ...custosManual, [produto.id]: e.target.value })
                              }
                              disabled={!produtosSelecionados.includes(produto.id)}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Botão Calcular */}
          {precosCalculados.length === 0 && (
            <Button
              onClick={handleCalcular}
              disabled={calculando || produtosSelecionados.length === 0}
              className="w-full"
            >
              {calculando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calculando...
                </>
              ) : (
                "Calcular Preços"
              )}
            </Button>
          )}

          {/* Preços Calculados */}
          {precosCalculados.length > 0 && (
            <div>
              <Label className="mb-2 block">Prévia dos Preços</Label>
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Produto</th>
                      <th className="p-2 text-right">Custo Base</th>
                      <th className="p-2 text-right">Preço Calculado</th>
                      <th className="p-2 text-right">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {precosCalculados.map((preco) => {
                      const produto = produtos?.find(p => p.id === preco.produto_id);
                      return (
                        <tr key={preco.produto_id} className="border-t">
                          <td className="p-2">{produto?.nome}</td>
                          <td className="p-2 text-right">{formatarMoeda(preco.custo_base)}</td>
                          <td className="p-2 text-right font-semibold">
                            {formatarMoeda(preco.preco_final)}
                          </td>
                          <td className="p-2 text-right text-green-600">
                            {preco.margem_lucro_percentual.toFixed(2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {precosCalculados.length > 0 && (
            <Button
              onClick={() => salvarPrecosMutation.mutate()}
              disabled={salvarPrecosMutation.isPending}
            >
              {salvarPrecosMutation.isPending ? "Salvando..." : "Salvar Preços"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
