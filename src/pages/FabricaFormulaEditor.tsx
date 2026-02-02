import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Save, ArrowLeft, Play, FileText, Plus, Layers, ListOrdered, Calculator } from "lucide-react";
import { FormulaItemRow } from "@/components/fabrica/FormulaItemRow";
import { SimuladorProducao } from "@/components/fabrica/SimuladorProducao";
import { FormulaTree } from "@/components/fabrica/FormulaTree";
import { RoteiroProducaoEditor } from "@/components/fabrica/RoteiroProducaoEditor";
import { FichaCustoEditor } from "@/components/fabrica/FichaCustoEditor";
import { validarFormula } from "@/lib/fabrica/formula-validator";
import { calcularCustoFormula } from "@/lib/fabrica/custo-calculator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function FabricaFormulaEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showSimulator, setShowSimulator] = useState(false);

  const { data: formula, isLoading } = useQuery({
    queryKey: ["fabrica-formula", id],
    queryFn: async () => {
      if (!id || id === "nova") return null;

      const { data, error } = await supabase
        .from("fabrica_formulas")
        .select(`
          *,
          fabrica_produtos (*),
          fabrica_formula_itens (
            *,
            fabrica_materias_primas (
              *,
              fabrica_unidades_medida (*)
            )
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && id !== "nova",
  });

  const { data: produtos, isLoading: isLoadingProdutos } = useQuery({
    queryKey: ["fabrica-produtos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_produtos")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  const { data: materiasPrimas } = useQuery({
    queryKey: ["fabrica-mps-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_materias_primas")
        .select("*, fabrica_unidades_medida (*)")
        .eq("status", "disponivel")
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  const { data: maquinas } = useQuery({
    queryKey: ["fabrica-maquinas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_maquinas")
        .select("*")
        .eq("status", "ativo")
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  const [produtoId, setProdutoId] = useState("");
  const [rendimento, setRendimento] = useState(100);
  const [tempoProducao, setTempoProducao] = useState(60);
  const [perdasEsperadas, setPerdasEsperadas] = useState(5);
  const [temperaturaIdeal, setTemperaturaIdeal] = useState<number | undefined>();
  const [phIdeal, setPhIdeal] = useState<number | undefined>();
  const [observacoesTecnicas, setObservacoesTecnicas] = useState("");
  const [itens, setItens] = useState<any[]>([]);
  const [roteiro, setRoteiro] = useState<any[]>([]);

  // Carregar dados quando fórmula for carregada
  useEffect(() => {
    if (formula) {
      setProdutoId(formula.produto_id || "");
      setRendimento(formula.rendimento_teorico || 100);
      setTempoProducao(formula.tempo_producao_minutos || 60);
      setPerdasEsperadas(formula.perdas_esperadas || 5);
      setTemperaturaIdeal(formula.temperatura_ideal);
      setPhIdeal(formula.ph_ideal);
      setObservacoesTecnicas(formula.observacoes_tecnicas || "");
      
      if (formula.fabrica_formula_itens) {
        setItens(formula.fabrica_formula_itens);
      }
    }
  }, [formula]);

  const adicionarItem = () => {
    setItens([
      ...itens,
      {
        id: crypto.randomUUID(),
        mp_id: "",
        quantidade: 0,
        percentual: 0,
        ordem_adicao: itens.length + 1,
        criticidade: "importante",
        permite_substituicao: false,
        observacoes_tecnicas: "",
      },
    ]);
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const atualizarItem = (index: number, campo: string, valor: any) => {
    const novosItens = [...itens];
    novosItens[index] = { ...novosItens[index], [campo]: valor };

    // Sincronizar percentual com quantidade
    if (campo === "percentual") {
      const total = novosItens.reduce(
        (sum, item) => sum + (item.percentual || 0),
        0
      );
      novosItens[index].quantidade = (valor / 100) * total;
    }

    setItens(novosItens);
  };

  const salvarMutation = useMutation({
    mutationFn: async () => {
      // Validar produto selecionado
      if (!produtoId) {
        throw new Error("Selecione um produto para a fórmula");
      }

      // Validar fórmula
      const validacao = validarFormula(itens);
      if (!validacao.valida) {
        throw new Error(validacao.erros.join("\n"));
      }

      if (validacao.avisos.length > 0) {
        validacao.avisos.forEach((aviso) => toast.warning(aviso));
      }

      // Obter ID do usuário
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      // Salvar fórmula e itens
      const { data: formulaSalva, error: formulaError } = await supabase
        .from("fabrica_formulas")
        .upsert({
          id: id !== "nova" ? id : undefined,
          produto_id: produtoId,
          rendimento_teorico: rendimento,
          tempo_producao_minutos: tempoProducao,
          perdas_esperadas: perdasEsperadas,
          temperatura_ideal: temperaturaIdeal,
          ph_ideal: phIdeal,
          observacoes_tecnicas: observacoesTecnicas,
          ativa: true,
          created_by: userId,
        })
        .select()
        .single();

      if (formulaError) throw formulaError;

      // Deletar itens antigos
      if (id !== "nova") {
        await supabase
          .from("fabrica_formula_itens")
          .delete()
          .eq("formula_id", formulaSalva.id);
      }

      // Inserir novos itens
      const { error: itensError } = await supabase
        .from("fabrica_formula_itens")
        .insert(
          itens.map((item) => ({
            formula_id: formulaSalva.id,
            mp_id: item.mp_id,
            quantidade: item.quantidade,
            percentual: item.percentual,
            ordem_adicao: item.ordem_adicao,
            criticidade: item.criticidade,
            permite_substituicao: item.permite_substituicao,
            mp_alternativa_id: item.mp_alternativa_id,
            observacoes_tecnicas: item.observacoes_tecnicas,
          }))
        );

      if (itensError) throw itensError;

      return formulaSalva;
    },
    onSuccess: () => {
      toast.success("Fórmula salva com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["fabrica-formulas"] });
      navigate("/dashboard/fabrica/formulas");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar fórmula");
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  const custoTotal = calcularCustoFormula(
    itens.map((item) => ({
      quantidade: item.quantidade,
      custo_unitario:
        materiasPrimas?.find((mp) => mp.id === item.mp_id)?.custo_unitario ||
        0,
    }))
  );

  const somaPercentuais = itens.reduce(
    (sum, item) => sum + (item.percentual || 0),
    0
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard/fabrica/formulas")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {(!id || id === "nova") ? "Nova Fórmula" : "Editar Fórmula"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {formula?.fabrica_produtos?.nome}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSimulator(true)}
              disabled={itens.length === 0 || !produtoId}
            >
              <Play className="mr-2 h-4 w-4" />
              Simular Produção
            </Button>
            <Button
              onClick={() => salvarMutation.mutate()}
              disabled={!produtoId || itens.length === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>

        {/* Seleção de Produto */}
        {(!id || id === "nova") && (
          <Card>
            <CardHeader>
              <CardTitle>Produto</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingProdutos ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div>
                  <Label>Selecione o Produto *</Label>
                  <Select value={produtoId} onValueChange={setProdutoId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecione o produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos?.map((produto) => (
                        <SelectItem key={produto.id} value={produto.id}>
                          {produto.codigo} - {produto.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Visualização em Árvore */}
        {itens.length > 0 && (formula || produtoId) && (
          <FormulaTree 
            formula={formula || { fabrica_produtos: produtos?.find(p => p.id === produtoId) }} 
            itens={itens} 
          />
        )}

        {/* Informações da Fórmula */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Técnicas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Rendimento (unidades)</Label>
              <Input
                type="number"
                value={rendimento}
                onChange={(e) => setRendimento(Number(e.target.value))}
                placeholder="100"
              />
            </div>
            <div>
              <Label>Tempo de Produção (min)</Label>
              <Input
                type="number"
                value={tempoProducao}
                onChange={(e) => setTempoProducao(Number(e.target.value))}
                placeholder="60"
              />
            </div>
            <div>
              <Label>Perdas Esperadas (%)</Label>
              <Input
                type="number"
                value={perdasEsperadas}
                onChange={(e) => setPerdasEsperadas(Number(e.target.value))}
                placeholder="5"
                step="0.1"
              />
            </div>
            <div>
              <Label>Temperatura Ideal (°C)</Label>
              <Input
                type="number"
                value={temperaturaIdeal || ""}
                onChange={(e) =>
                  setTemperaturaIdeal(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="25"
              />
            </div>
            <div>
              <Label>pH Ideal</Label>
              <Input
                type="number"
                value={phIdeal || ""}
                onChange={(e) =>
                  setPhIdeal(e.target.value ? Number(e.target.value) : undefined)
                }
                placeholder="7.0"
                step="0.1"
              />
            </div>
            <div className="md:col-span-3">
              <Label>Observações Técnicas</Label>
              <Textarea
                value={observacoesTecnicas}
                onChange={(e) => setObservacoesTecnicas(e.target.value)}
                placeholder="Instruções especiais, cuidados, etc."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Ingredientes, Roteiro e Ficha de Custos */}
        <Tabs defaultValue="ingredientes" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ingredientes">
              <Layers className="h-4 w-4 mr-2" />
              Ingredientes
            </TabsTrigger>
            <TabsTrigger value="roteiro">
              <ListOrdered className="h-4 w-4 mr-2" />
              Roteiro
            </TabsTrigger>
            <TabsTrigger value="custos" disabled={!id || id === "nova"}>
              <Calculator className="h-4 w-4 mr-2" />
              Ficha de Custos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ingredientes">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Ingredientes</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Soma dos percentuais:{" "}
                      <span
                        className={
                          Math.abs(somaPercentuais - 100) > 0.01
                            ? "text-destructive font-medium"
                            : "text-success font-medium"
                        }
                      >
                        {somaPercentuais.toFixed(2)}%
                      </span>
                    </p>
                  </div>
                  <Button onClick={adicionarItem} variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Ingrediente
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {itens.map((item, index) => (
                    <FormulaItemRow
                      key={item.id}
                      item={item}
                      index={index}
                      materiasPrimas={materiasPrimas || []}
                      onUpdate={atualizarItem}
                      onRemove={removerItem}
                    />
                  ))}
                  {itens.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4" />
                      <p>Nenhum ingrediente adicionado ainda</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roteiro">
            <RoteiroProducaoEditor
              formulaId={id && id !== "nova" ? id : ""}
              maquinas={maquinas || []}
              onSave={(steps) => setRoteiro(steps)}
              initialSteps={roteiro}
            />
          </TabsContent>

          <TabsContent value="custos">
            {id && id !== "nova" && (
              <FichaCustoEditor
                formulaId={id}
                itens={itens}
                materiasPrimas={materiasPrimas || []}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Resumo de Custos */}
        {itens.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Resumo de Custos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Custo Total Estimado:</span>
                <span className="text-primary">
                  R$ {custoTotal.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Simulador de Produção */}
      {showSimulator && (
        <SimuladorProducao
          formulaId={id || ""}
          onClose={() => setShowSimulator(false)}
        />
      )}
    </DashboardLayout>
  );
}
