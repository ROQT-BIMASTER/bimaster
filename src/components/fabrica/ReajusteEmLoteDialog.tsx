import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatarMoeda } from "@/lib/fabrica/pricing-calculator";
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Package,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabela: any;
  onSuccess: () => void;
}

export function ReajusteEmLoteDialog({ open, onOpenChange, tabela, onSuccess }: Props) {
  const [step, setStep] = useState<"filtros" | "preview" | "confirmacao">("filtros");
  const [tipoReajuste, setTipoReajuste] = useState<"percentual" | "valor_fixo">("percentual");
  const [valorReajuste, setValorReajuste] = useState("");
  const [direcao, setDirecao] = useState<"aumento" | "reducao">("aumento");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroMarca, setFiltroMarca] = useState<string>("todas");
  const [filtroFaixaPreco, setFiltroFaixaPreco] = useState<string>("todas");
  const [produtosSelecionados, setProdutosSelecionados] = useState<Set<string>>(new Set());
  const [arredondamento, setArredondamento] = useState<"nenhum" | "centavos" | "inteiro">("centavos");

  // Buscar preços da tabela
  const { data: precos, isLoading } = useQuery({
    queryKey: ["reajuste-precos", tabela?.id],
    queryFn: async () => {
      if (!tabela?.id) return [];

      const { data: precosData, error } = await supabase
        .from("fabrica_precos_produtos")
        .select("*")
        .eq("tabela_id", tabela.id)
        .eq("ativo", true);

      if (error) throw error;

      const produtoIds = [...new Set(precosData.map(p => p.produto_id))];
      
      const { data: produtosData } = await supabase
        .from("fabrica_produtos")
        .select("id, codigo, nome, categoria, marca")
        .in("id", produtoIds);

      const produtosMap = new Map(produtosData?.map(p => [p.id, p]) || []);

      return precosData.map(preco => ({
        ...preco,
        produto: produtosMap.get(preco.produto_id),
      }));
    },
    enabled: open && !!tabela?.id,
  });

  // Extrair categorias e marcas únicas
  const categorias = useMemo(() => {
    const cats = new Set<string>();
    precos?.forEach(p => p.produto?.categoria && cats.add(p.produto.categoria));
    return Array.from(cats).sort();
  }, [precos]);

  const marcas = useMemo(() => {
    const mcs = new Set<string>();
    precos?.forEach(p => p.produto?.marca && mcs.add(p.produto.marca));
    return Array.from(mcs).sort();
  }, [precos]);

  // Filtrar preços
  const precosFiltrados = useMemo(() => {
    return precos?.filter(p => {
      if (filtroCategoria !== "todas" && p.produto?.categoria !== filtroCategoria) return false;
      if (filtroMarca !== "todas" && p.produto?.marca !== filtroMarca) return false;
      if (filtroFaixaPreco !== "todas") {
        const preco = p.preco_final || 0;
        switch (filtroFaixaPreco) {
          case "ate50": if (preco >= 50) return false; break;
          case "50a100": if (preco < 50 || preco >= 100) return false; break;
          case "100a250": if (preco < 100 || preco >= 250) return false; break;
          case "250a500": if (preco < 250 || preco >= 500) return false; break;
          case "acima500": if (preco < 500) return false; break;
        }
      }
      return true;
    }) || [];
  }, [precos, filtroCategoria, filtroMarca, filtroFaixaPreco]);

  // Calcular preview dos novos preços
  const previewPrecos = useMemo(() => {
    const valor = parseFloat(valorReajuste) || 0;
    const multiplicador = direcao === "aumento" ? 1 : -1;

    return precosFiltrados
      .filter(p => produtosSelecionados.size === 0 || produtosSelecionados.has(p.produto_id))
      .map(p => {
        let novoPreco = p.preco_final || 0;

        if (tipoReajuste === "percentual") {
          novoPreco = novoPreco * (1 + (valor * multiplicador) / 100);
        } else {
          novoPreco = novoPreco + (valor * multiplicador);
        }

        // Arredondamento
        if (arredondamento === "centavos") {
          novoPreco = Math.round(novoPreco * 100) / 100;
        } else if (arredondamento === "inteiro") {
          novoPreco = Math.round(novoPreco);
        }

        novoPreco = Math.max(0, novoPreco);

        const variacao = p.preco_final > 0 
          ? ((novoPreco - p.preco_final) / p.preco_final) * 100 
          : 0;

        return {
          ...p,
          precoAnterior: p.preco_final,
          precoNovo: novoPreco,
          variacao,
        };
      });
  }, [precosFiltrados, valorReajuste, tipoReajuste, direcao, arredondamento, produtosSelecionados]);

  // Mutation para aplicar reajuste
  const reajusteMutation = useMutation({
    mutationFn: async () => {
      // Buscar preço da tabela base se existir
      let precosTabelaBase: Record<string, number> = {};
      if (tabela?.tabela_base_id) {
        const { data: precosBase } = await supabase
          .from("fabrica_precos_produtos")
          .select("produto_id, preco_final")
          .eq("tabela_id", tabela.tabela_base_id)
          .eq("ativo", true);
        
        if (precosBase) {
          precosTabelaBase = Object.fromEntries(
            precosBase.map(p => [p.produto_id, p.preco_final || 0])
          );
        }
      }

      const updates = previewPrecos.map(p => {
        const precoBase = precosTabelaBase[p.produto_id];
        const referencia = precoBase && precoBase > 0 ? precoBase : (p.custo_base || 0);
        const margem = p.precoNovo > 0 && referencia > 0
          ? ((p.precoNovo - referencia) / p.precoNovo) * 100
          : 0;
        
        return {
          id: p.id,
          preco_final: p.precoNovo,
          preco_manual: p.precoNovo,
          margem_lucro_percentual: margem,
        };
      });

      for (const update of updates) {
        const { error } = await supabase
          .from("fabrica_precos_produtos")
          .update({
            preco_final: update.preco_final,
            preco_manual: update.preco_manual,
            margem_lucro_percentual: update.margem_lucro_percentual,
          })
          .eq("id", update.id);

        if (error) throw error;
      }

      // Registrar na auditoria
      const { data: user } = await supabase.auth.getUser();
      await supabase.from("fabrica_tabelas_preco_auditoria").insert({
        tabela_id: tabela.id,
        user_id: user.user?.id,
        acao: "reajuste_lote",
        mensagem: `Reajuste em lote: ${direcao === "aumento" ? "+" : "-"}${valorReajuste}${tipoReajuste === "percentual" ? "%" : "R$"} em ${updates.length} produtos`,
        diff: {
          tipo: tipoReajuste,
          valor: parseFloat(valorReajuste),
          direcao,
          produtos_afetados: updates.length,
        },
      });
    },
    onSuccess: () => {
      toast.success(`Reajuste aplicado em ${previewPrecos.length} produtos!`);
      onSuccess();
      handleClose();
    },
    onError: (error: any) => {
      toast.error("Erro ao aplicar reajuste: " + error.message);
    },
  });

  const handleClose = () => {
    setStep("filtros");
    setValorReajuste("");
    setFiltroCategoria("todas");
    setFiltroMarca("todas");
    setFiltroFaixaPreco("todas");
    setProdutosSelecionados(new Set());
    onOpenChange(false);
  };

  const toggleProduto = (produtoId: string) => {
    const novo = new Set(produtosSelecionados);
    if (novo.has(produtoId)) {
      novo.delete(produtoId);
    } else {
      novo.add(produtoId);
    }
    setProdutosSelecionados(novo);
  };

  const selecionarTodos = () => {
    if (produtosSelecionados.size === precosFiltrados.length) {
      setProdutosSelecionados(new Set());
    } else {
      setProdutosSelecionados(new Set(precosFiltrados.map(p => p.produto_id)));
    }
  };

  if (!tabela) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Reajuste em Lote - {tabela.nome}</DialogTitle>
          <DialogDescription>
            {step === "filtros" && "Defina os filtros e o tipo de reajuste"}
            {step === "preview" && "Revise as alterações antes de aplicar"}
            {step === "confirmacao" && "Confirme a aplicação do reajuste"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : step === "filtros" ? (
          <div className="space-y-6 flex-1 overflow-auto">
            {/* Tipo de Reajuste */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Tipo de Reajuste</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Direção</Label>
                    <RadioGroup value={direcao} onValueChange={(v) => setDirecao(v as any)} className="flex gap-4 mt-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="aumento" id="aumento" />
                        <Label htmlFor="aumento" className="font-normal flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-red-600" />
                          Aumento
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="reducao" id="reducao" />
                        <Label htmlFor="reducao" className="font-normal flex items-center gap-1">
                          <TrendingDown className="h-4 w-4 text-green-600" />
                          Redução
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <RadioGroup value={tipoReajuste} onValueChange={(v) => setTipoReajuste(v as any)} className="flex gap-4 mt-2">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="percentual" id="percentual" />
                        <Label htmlFor="percentual" className="font-normal">Percentual (%)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="valor_fixo" id="valor_fixo" />
                        <Label htmlFor="valor_fixo" className="font-normal">Valor Fixo (R$)</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor do Reajuste</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorReajuste}
                      onChange={(e) => setValorReajuste(e.target.value)}
                      placeholder={tipoReajuste === "percentual" ? "Ex: 10" : "Ex: 5.00"}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Arredondamento</Label>
                    <Select value={arredondamento} onValueChange={(v) => setArredondamento(v as any)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Nenhum</SelectItem>
                        <SelectItem value="centavos">Centavos (0,01)</SelectItem>
                        <SelectItem value="inteiro">Inteiro (1,00)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filtros */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Categoria</Label>
                    <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        {categorias.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Marca</Label>
                    <Select value={filtroMarca} onValueChange={setFiltroMarca}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        {marcas.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Faixa de Preço</Label>
                    <Select value={filtroFaixaPreco} onValueChange={setFiltroFaixaPreco}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        <SelectItem value="ate50">Até R$ 50</SelectItem>
                        <SelectItem value="50a100">R$ 50 - R$ 100</SelectItem>
                        <SelectItem value="100a250">R$ 100 - R$ 250</SelectItem>
                        <SelectItem value="250a500">R$ 250 - R$ 500</SelectItem>
                        <SelectItem value="acima500">Acima de R$ 500</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    <Package className="h-4 w-4 inline mr-1" />
                    {precosFiltrados.length} produtos encontrados
                  </span>
                  <Button variant="outline" size="sm" onClick={selecionarTodos}>
                    {produtosSelecionados.size === precosFiltrados.length ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Produtos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Produtos ({produtosSelecionados.size > 0 ? `${produtosSelecionados.size} selecionados` : "todos filtrados serão afetados"})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {precosFiltrados.map(p => (
                      <div 
                        key={p.id} 
                        className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted cursor-pointer"
                        onClick={() => toggleProduto(p.produto_id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={produtosSelecionados.size === 0 || produtosSelecionados.has(p.produto_id)}
                          />
                          <div>
                            <p className="font-medium text-sm">{p.produto?.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.produto?.codigo} | {p.produto?.categoria || "-"}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-sm">{formatarMoeda(p.preco_final)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ) : step === "preview" ? (
          <div className="flex-1 overflow-auto space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Produtos Afetados</p>
                  <p className="text-2xl font-bold">{previewPrecos.length}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-yellow-500">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Variação Média</p>
                  <p className="text-2xl font-bold">
                    {previewPrecos.length > 0 
                      ? `${(previewPrecos.reduce((acc, p) => acc + p.variacao, 0) / previewPrecos.length).toFixed(1)}%`
                      : "-"
                    }
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Novo Preço Médio</p>
                  <p className="text-2xl font-bold">
                    {formatarMoeda(previewPrecos.reduce((acc, p) => acc + p.precoNovo, 0) / (previewPrecos.length || 1))}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Alterações */}
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-3 text-left">Produto</th>
                        <th className="p-3 text-right">Preço Atual</th>
                        <th className="p-3 text-right">Novo Preço</th>
                        <th className="p-3 text-right">Variação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewPrecos.map(p => (
                        <tr key={p.id} className="border-t">
                          <td className="p-3">
                            <p className="font-medium">{p.produto?.nome}</p>
                            <p className="text-xs text-muted-foreground">{p.produto?.codigo}</p>
                          </td>
                          <td className="p-3 text-right font-mono">{formatarMoeda(p.precoAnterior)}</td>
                          <td className="p-3 text-right font-mono font-semibold">{formatarMoeda(p.precoNovo)}</td>
                          <td className="p-3 text-right">
                            <Badge variant={p.variacao > 0 ? "destructive" : p.variacao < 0 ? "default" : "secondary"}>
                              {p.variacao > 0 ? "+" : ""}{p.variacao.toFixed(1)}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="py-8 text-center space-y-4">
            <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Confirmar Reajuste</h3>
              <p className="text-muted-foreground">
                Esta ação irá alterar {previewPrecos.length} preços na tabela <strong>{tabela.nome}</strong>.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Reajuste: {direcao === "aumento" ? "+" : "-"}{valorReajuste}{tipoReajuste === "percentual" ? "%" : " R$"}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "filtros" && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button 
                onClick={() => setStep("preview")}
                disabled={!valorReajuste || parseFloat(valorReajuste) <= 0 || precosFiltrados.length === 0}
              >
                Visualizar Preview
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("filtros")}>Voltar</Button>
              <Button onClick={() => setStep("confirmacao")}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar Reajuste
              </Button>
            </>
          )}
          {step === "confirmacao" && (
            <>
              <Button variant="outline" onClick={() => setStep("preview")}>Voltar</Button>
              <Button 
                onClick={() => reajusteMutation.mutate()}
                disabled={reajusteMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {reajusteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Aplicar Reajuste
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
