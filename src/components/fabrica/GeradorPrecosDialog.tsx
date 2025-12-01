import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { calcularPrecosProdutos, formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { Loader2 } from "lucide-react";

interface ProdutoData {
  id: string;
  codigo: string | null;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabela: any;
  onSuccess: () => void;
}

export function GeradorPrecosDialog({ open, onOpenChange, tabela, onSuccess }: Props) {
  const [fonteCusto, setFonteCusto] = useState<"ordem_producao" | "custo_medio" | "manual" | "tabela_anterior">("ordem_producao");
  const [produtosSelecionados, setProdutosSelecionados] = useState<string[]>([]);
  const [custosManual, setCustosManual] = useState<Record<string, string>>({});
  const [precosCalculados, setPrecosCalculados] = useState<any[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoData[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [buscaProduto, setBuscaProduto] = useState("");

  useEffect(() => {
    if (open && tabela) {
      loadProdutos();
    }
  }, [open, tabela]);

  const loadProdutos = async () => {
    setLoadingProdutos(true);
    try {
      // Buscar apenas produtos acabados finalizados
      const response = await supabase
        .from("fabrica_produtos")
        .select("id, codigo, nome")
        .eq("tipo", "ACABADO")
        .eq("ativo", true)
        .order("nome");

      if (response.error) throw response.error;
      setProdutos(response.data || []);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoadingProdutos(false);
    }
  };

  useEffect(() => {
    if (tabela?.tipo_base === "tabela_anterior") {
      setFonteCusto("tabela_anterior");
    }
  }, [tabela]);

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
        ativo: true,
        atualizado_por: user?.user?.id,
      }));

      const { error } = await supabase
        .from("fabrica_precos_produtos")
        .upsert(registros, {
          onConflict: "tabela_id,produto_id",
        });

      if (error) throw error;

      // Atualizar status da tabela para pending_approval
      await supabase
        .from("fabrica_tabelas_preco")
        .update({ status: 'pending_approval' })
        .eq("id", tabela.id);
    },
    onSuccess: () => {
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
          {/* Fonte do Custo */}
          {tabela.tipo_base !== "tabela_anterior" && (
            <div>
              <Label>Fonte do Custo Base</Label>
              <RadioGroup value={fonteCusto} onValueChange={(value: any) => setFonteCusto(value)}>
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
                          <div>
                            <div className="font-medium">{produto.nome}</div>
                            <div className="text-sm text-muted-foreground">{produto.codigo}</div>
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
