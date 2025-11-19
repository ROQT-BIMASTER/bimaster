import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Link2, Plus, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { materiaPrimaSchema } from "@/lib/validations/materia-prima";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NovaCategoriaMP } from "./NovaCategoriaMP";
import { NovoMateriaPrimaDialog } from "./NovoMateriaPrimaDialog";
import { DadosFiscaisProdutoDialog } from "./DadosFiscaisProdutoDialog";

interface MapearProdutosDialogProps {
  notaId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ItemPendente {
  id: string;
  numero_item: number;
  codigo_fornecedor: string;
  descricao: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
}

export function MapearProdutosDialog({ notaId, open, onOpenChange }: MapearProdutosDialogProps) {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<ItemPendente | null>(null);
  const [acao, setAcao] = useState<"vincular" | "criar">("vincular");
  const [showNovaCategoriaDialog, setShowNovaCategoriaDialog] = useState(false);
  const [showNovoMateriaPrimaDialog, setShowNovoMateriaPrimaDialog] = useState(false);
  const [showDadosFiscaisDialog, setShowDadosFiscaisDialog] = useState(false);
  const [produtoIdParaFiscal, setProdutoIdParaFiscal] = useState<string | null>(null);
  const [produtoNomeParaFiscal, setProdutoNomeParaFiscal] = useState<string>("");
  
  // Campos para vincular
  const [produtoInternoId, setProdutoInternoId] = useState("");
  const [fatorConversao, setFatorConversao] = useState("1");
  
  // Campos para criar novo
  const [novoProduto, setNovoProduto] = useState({
    codigo: "",
    nome: "",
    categoria_id: "",
    unidade_medida_id: "",
    custo_unitario: "",
  });

  // Buscar itens pendentes da nota
  const { data: itensPendentes, isLoading } = useQuery({
    queryKey: ["itens-pendentes", notaId],
    queryFn: async () => {
      if (!notaId) return [];
      
      const { data, error } = await supabase
        .from("fabrica_itens_nf")
        .select("*")
        .eq("nota_id", notaId)
        .eq("status_mapeamento", "pending");

      if (error) throw error;
      return data as ItemPendente[];
    },
    enabled: !!notaId && open,
  });

  // Buscar produtos internos
  const { data: produtosInternos } = useQuery({
    queryKey: ["produtos-internos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_materias_primas")
        .select("id, codigo, nome")
        .eq("status", "ativo")
        .order("nome");

      if (error) throw error;
      return (data || []) as Array<{id: string; codigo: string; nome: string}>;
    },
    enabled: open && acao === "vincular",
  });

  // Buscar categorias
  const { data: categorias } = useQuery({
    queryKey: ["categorias-mp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_categorias_mp")
        .select("id, nome")
        .eq("ativa", true)
        .order("nome");

      if (error) throw error;
      return (data || []) as Array<{id: string; nome: string}>;
    },
    enabled: open && acao === "criar",
  });

  // Buscar unidades de medida
  const { data: unidades } = useQuery<Array<{id: string; sigla: string; nome: string}>>({
    queryKey: ["unidades-medida"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_unidades_medida")
        .select("*");

      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        sigla: d.sigla,
        nome: d.nome
      }));
    },
    enabled: open && acao === "criar",
  });

  // Mutation para vincular
  const vincularMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem || !produtoInternoId) return;

      const { data: nota } = await supabase
        .from("fabrica_notas_fiscais")
        .select("fornecedor_id")
        .eq("id", notaId)
        .single();

      if (!nota) throw new Error("Nota não encontrada");

      // Criar código de fornecedor
      const { data: codigo, error: codigoError } = await supabase
        .from("fabrica_codigos_fornecedor")
        .insert({
          fornecedor_id: nota.fornecedor_id,
          codigo_fornecedor: selectedItem.codigo_fornecedor,
          descricao_fornecedor: selectedItem.descricao,
          produto_interno_id: produtoInternoId,
          fator_conversao: parseFloat(fatorConversao),
          unidade_fornecedor: selectedItem.unidade,
        })
        .select()
        .single();

      if (codigoError) throw codigoError;

      // Atualizar item da nota
      const { error: updateError } = await supabase
        .from("fabrica_itens_nf")
        .update({
          produto_interno_id: produtoInternoId,
          codigo_mapeado_id: codigo.id,
          status_mapeamento: "mapped",
          quantidade_convertida: selectedItem.quantidade * parseFloat(fatorConversao),
        })
        .eq("id", selectedItem.id);

      if (updateError) throw updateError;
    },
    onSuccess: async () => {
      // Buscar nome do produto vinculado
      const { data: produto } = await supabase
        .from("fabrica_materias_primas")
        .select("nome")
        .eq("id", produtoInternoId)
        .single();
      
      toast.success("Produto vinculado! Agora configure as regras fiscais.");
      queryClient.invalidateQueries({ queryKey: ["itens-pendentes", notaId] });
      
      // Abrir dialog de dados fiscais OBRIGATORIAMENTE
      setProdutoIdParaFiscal(produtoInternoId);
      setProdutoNomeParaFiscal(produto?.nome || "Produto");
      setShowDadosFiscaisDialog(true);
      
      setSelectedItem(null);
      setProdutoInternoId("");
      setFatorConversao("1");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao vincular produto");
    },
  });

  // Mutation para criar
  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) return null;

      // Validar dados antes de criar
      try {
        materiaPrimaSchema.parse({
          codigo: novoProduto.codigo,
          nome: novoProduto.nome,
          categoria_id: novoProduto.categoria_id || null,
          unidade_medida_id: novoProduto.unidade_medida_id,
          custo_unitario: parseFloat(novoProduto.custo_unitario),
        });
      } catch (validationError: any) {
        const firstError = validationError.errors?.[0];
        throw new Error(firstError?.message || "Erro de validação nos dados do produto");
      }

      // Criar produto interno
      const { data: session } = await supabase.auth.getSession();
      
      const { data: produto, error: produtoError } = await supabase
        .from("fabrica_materias_primas")
        .insert({
          codigo: novoProduto.codigo.trim(),
          nome: novoProduto.nome.trim(),
          categoria_id: novoProduto.categoria_id || null,
          unidade_medida_id: novoProduto.unidade_medida_id,
          custo_unitario: parseFloat(novoProduto.custo_unitario),
          status: "ativo",
          created_by: session.session?.user.id,
        })
        .select()
        .single();

      if (produtoError) {
        console.error("Erro ao criar produto:", produtoError);
        throw new Error(produtoError.message || "Erro ao criar produto interno");
      }

      const { data: nota } = await supabase
        .from("fabrica_notas_fiscais")
        .select("fornecedor_id")
        .eq("id", notaId)
        .single();

      if (!nota) throw new Error("Nota não encontrada");

      // Criar código de fornecedor
      const { data: codigo, error: codigoError } = await supabase
        .from("fabrica_codigos_fornecedor")
        .insert({
          fornecedor_id: nota.fornecedor_id,
          codigo_fornecedor: selectedItem.codigo_fornecedor,
          descricao_fornecedor: selectedItem.descricao,
          produto_interno_id: produto.id,
          fator_conversao: parseFloat(fatorConversao),
          unidade_fornecedor: selectedItem.unidade,
        })
        .select()
        .single();

      if (codigoError) throw codigoError;

      // Atualizar item da nota
      const { error: updateError } = await supabase
        .from("fabrica_itens_nf")
        .update({
          produto_interno_id: produto.id,
          codigo_mapeado_id: codigo.id,
          status_mapeamento: "mapped",
          quantidade_convertida: selectedItem.quantidade * parseFloat(fatorConversao),
        })
        .eq("id", selectedItem.id);

      if (updateError) throw updateError;
      
      // Retornar produto criado para usar no onSuccess
      return produto;
    },
    onSuccess: (produto) => {
      if (!produto) return;
      
      toast.success("Produto criado! Agora configure as regras fiscais.");
      queryClient.invalidateQueries({ queryKey: ["itens-pendentes", notaId] });
      
      // Abrir dialog de dados fiscais OBRIGATORIAMENTE
      setProdutoIdParaFiscal(produto.id);
      setProdutoNomeParaFiscal(produto.nome);
      setShowDadosFiscaisDialog(true);
      
      setSelectedItem(null);
      setNovoProduto({
        codigo: "",
        nome: "",
        categoria_id: "",
        unidade_medida_id: "",
        custo_unitario: "",
      });
      setFatorConversao("1");
    },
    onError: (error: any) => {
      console.error("Erro completo ao criar produto:", error);
      toast.error(error.message || "Erro ao criar produto");
    },
  });

  const handleSubmit = () => {
    if (acao === "vincular") {
      vincularMutation.mutate();
    } else {
      criarMutation.mutate();
    }
  };

  const handleClose = () => {
    if (itensPendentes && itensPendentes.length === 0) {
      toast.success("Todos os produtos foram mapeados!");
      queryClient.invalidateQueries({ queryKey: ["nota-fiscal", notaId] });
      queryClient.invalidateQueries({ queryKey: ["nota-fiscal-itens", notaId] });
      onOpenChange(false);
    } else {
      toast.warning("Ainda há produtos pendentes de mapeamento");
    }
  };

  // Sempre renderizar o dialog quando open=true
  // mas mostrar mensagem de sucesso se não há mais itens

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mapear Produtos do Fornecedor</DialogTitle>
          <DialogDescription>
            {!itensPendentes || itensPendentes.length === 0 ? (
              <span className="text-green-600 font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Todos os produtos foram mapeados com sucesso!
              </span>
            ) : (
              <>
                {itensPendentes.length} {itensPendentes.length === 1 ? "produto precisa" : "produtos precisam"} ser mapeado(s) para produtos internos
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!itensPendentes || itensPendentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Mapeamento Concluído!</h3>
            <p className="text-muted-foreground mb-4">
              Todos os produtos desta nota foram mapeados com sucesso.
            </p>
            <Button onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Lista de itens pendentes */}
            <div className="space-y-2">
              <h3 className="font-semibold">
                Produtos Pendentes 
                <Badge variant="secondary" className="ml-2">
                  {itensPendentes.length}
                </Badge>
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  itensPendentes.map((item) => (
                  <Card
                    key={item.id}
                    className={`cursor-pointer transition-colors ${
                      selectedItem?.id === item.id ? "border-primary bg-accent" : ""
                    }`}
                    onClick={() => {
                      setSelectedItem(item);
                      setNovoProduto({
                        codigo: item.codigo_fornecedor,
                        nome: item.descricao,
                        categoria_id: "",
                        unidade_medida_id: "",
                        custo_unitario: item.valor_unitario.toString(),
                      });
                    }}
                  >
                    <CardHeader className="p-3">
                      <CardTitle className="text-sm">Item {item.numero_item}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-sm font-medium">{item.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        Código: {item.codigo_fornecedor} | NCM: {item.ncm}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantidade} {item.unidade} × R$ {item.valor_unitario.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  ))
                )}
              </div>
            </div>

            {/* Formulário de mapeamento */}
            <div className="space-y-4">
            {selectedItem ? (
              <>
                <h3 className="font-semibold">Mapear: {selectedItem.descricao}</h3>

                <Tabs value={acao} onValueChange={(v) => setAcao(v as "vincular" | "criar")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="vincular">
                      <Link2 className="h-4 w-4 mr-2" />
                      Vincular Existente
                    </TabsTrigger>
                    <TabsTrigger value="criar">
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Novo
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="vincular" className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Produto Interno</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNovoMateriaPrimaDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Novo
                        </Button>
                      </div>
                      <Select value={produtoInternoId} onValueChange={setProdutoInternoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o produto interno" />
                        </SelectTrigger>
                        <SelectContent>
                          {produtosInternos?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.codigo} - {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Fator de Conversão</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={fatorConversao}
                        onChange={(e) => setFatorConversao(e.target.value)}
                        placeholder="1.0"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Ex: Se fornecedor vende em kg e você usa em g, use 1000
                      </p>
                    </div>

                    <Button
                      onClick={handleSubmit}
                      disabled={!produtoInternoId || vincularMutation.isPending}
                      className="w-full"
                    >
                      {vincularMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Vinculando...
                        </>
                      ) : (
                        "Vincular Produto"
                      )}
                    </Button>
                  </TabsContent>

                  <TabsContent value="criar" className="space-y-4">
                    <div>
                      <Label>Código *</Label>
                      <Input
                        value={novoProduto.codigo}
                        onChange={(e) => setNovoProduto({ ...novoProduto, codigo: e.target.value })}
                        placeholder="Ex: MP001"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Apenas letras, números, hífen e underscore
                      </p>
                    </div>

                    <div>
                      <Label>Nome *</Label>
                      <Input
                        value={novoProduto.nome}
                        onChange={(e) => setNovoProduto({ ...novoProduto, nome: e.target.value })}
                        placeholder="Nome do produto"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Categoria (Opcional)</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNovaCategoriaDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Nova
                        </Button>
                      </div>
                      <Select
                        value={novoProduto.categoria_id}
                        onValueChange={(v) => setNovoProduto({ ...novoProduto, categoria_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Unidade de Medida *</Label>
                      <Select
                        value={novoProduto.unidade_medida_id}
                        onValueChange={(v) => setNovoProduto({ ...novoProduto, unidade_medida_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a unidade" />
                        </SelectTrigger>
                        <SelectContent>
                          {unidades?.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.sigla} - {u.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Custo Unitário *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={novoProduto.custo_unitario}
                        onChange={(e) => setNovoProduto({ ...novoProduto, custo_unitario: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <Label>Fator de Conversão</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={fatorConversao}
                        onChange={(e) => setFatorConversao(e.target.value)}
                        placeholder="1.0"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Ex: Se fornecedor vende em kg e você usa em g, use 1000
                      </p>
                    </div>

                    <Button
                      onClick={handleSubmit}
                      disabled={
                        !novoProduto.codigo.trim() ||
                        !novoProduto.nome.trim() ||
                        !novoProduto.unidade_medida_id ||
                        !novoProduto.custo_unitario ||
                        parseFloat(novoProduto.custo_unitario) <= 0 ||
                        criarMutation.isPending
                      }
                      className="w-full"
                    >
                      {criarMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        "Criar e Vincular"
                      )}
                    </Button>
                    
                    {(!novoProduto.codigo.trim() || 
                      !novoProduto.nome.trim() || 
                      !novoProduto.unidade_medida_id || 
                      !novoProduto.custo_unitario ||
                      parseFloat(novoProduto.custo_unitario) <= 0) && (
                      <p className="text-xs text-destructive text-center">
                        * Preencha todos os campos obrigatórios
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Selecione um produto para mapear
              </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      <NovaCategoriaMP
        open={showNovaCategoriaDialog}
        onOpenChange={setShowNovaCategoriaDialog}
        onSuccess={(categoryId, categoryName) => {
          // Atualizar lista de categorias
          queryClient.invalidateQueries({ queryKey: ["categorias-mp"] });
          // Selecionar a categoria recém-criada
          setNovoProduto({ ...novoProduto, categoria_id: categoryId });
          toast.success(`Categoria "${categoryName}" criada com sucesso`);
        }}
      />

      <NovoMateriaPrimaDialog
        open={showNovoMateriaPrimaDialog}
        onOpenChange={setShowNovoMateriaPrimaDialog}
        onSuccess={(productId, productName) => {
          // Atualizar lista de produtos internos
          queryClient.invalidateQueries({ queryKey: ["produtos-internos"] });
          // Selecionar o produto recém-criado
          setProdutoInternoId(productId);
          toast.success(`Produto "${productName}" criado com sucesso`);
        }}
      />
      
      <DadosFiscaisProdutoDialog
        open={showDadosFiscaisDialog}
        onOpenChange={setShowDadosFiscaisDialog}
        produtoId={produtoIdParaFiscal || ""}
        produtoNome={produtoNomeParaFiscal}
      />
    </Dialog>
  );
}
