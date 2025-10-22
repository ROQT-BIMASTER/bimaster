import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X } from "lucide-react";
import { CadastroRapidoProdutoDialog } from "./CadastroRapidoProdutoDialog";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface AuditoriaGondolaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId?: string;
  storeId: string;
  onSuccess?: () => void;
}

interface ConcorrenteForm {
  nome: string;
  quantidade_frentes: number;
  produto_nome: string;
  preco_praticado: number;
}

interface ProdutoAuditoria {
  product_id: string;
  produto_ean: string;
  produto_descricao: string;
  preco_praticado: number;
  estoque_loja: number;
  produto_presente: boolean;
  quantidade_frentes: number;
  conforme_planograma: boolean;
}

export function AuditoriaGondolaDialog({
  open,
  onOpenChange,
  visitId,
  storeId,
  onSuccess,
}: AuditoriaGondolaDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [concorrentes, setConcorrentes] = useState<ConcorrenteForm[]>([]);
  const [produtosAuditoria, setProdutosAuditoria] = useState<ProdutoAuditoria[]>([{
    product_id: "",
    produto_ean: "",
    produto_descricao: "",
    preco_praticado: 0,
    estoque_loja: 0,
    produto_presente: true,
    quantidade_frentes: 0,
    conforme_planograma: false,
  }]);
  const [concorrentesPresentes, setConcorrentesPresentes] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [showCadastroProduto, setShowCadastroProduto] = useState(false);
  const [currentProductIndex, setCurrentProductIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, sku")
      .eq("active", true)
      .order("name");
    if (data) setProducts(data);
  };

  const addProduto = () => {
    if (produtosAuditoria.length >= 20) {
      toast({ title: "Limite atingido", description: "Máximo de 20 produtos por auditoria", variant: "destructive" });
      return;
    }
    setProdutosAuditoria([...produtosAuditoria, {
      product_id: "",
      produto_ean: "",
      produto_descricao: "",
      preco_praticado: 0,
      estoque_loja: 0,
      produto_presente: true,
      quantidade_frentes: 0,
      conforme_planograma: false,
    }]);
  };

  const removeProduto = (index: number) => {
    if (produtosAuditoria.length === 1) {
      toast({ title: "Erro", description: "Deve haver pelo menos 1 produto", variant: "destructive" });
      return;
    }
    setProdutosAuditoria(produtosAuditoria.filter((_, i) => i !== index));
  };

  const updateProduto = (index: number, field: keyof ProdutoAuditoria, value: any) => {
    const updated = [...produtosAuditoria];
    (updated[index] as any)[field] = value;
    setProdutosAuditoria(updated);
  };

  const addConcorrente = () => {
    if (concorrentes.length >= 5) {
      toast({ title: "Limite atingido", description: "Máximo de 5 concorrentes", variant: "destructive" });
      return;
    }
    setConcorrentes([...concorrentes, { nome: "", quantidade_frentes: 0, produto_nome: "", preco_praticado: 0 }]);
  };

  const removeConcorrente = (index: number) => {
    setConcorrentes(concorrentes.filter((_, i) => i !== index));
  };

  const updateConcorrente = (index: number, field: keyof ConcorrenteForm, value: any) => {
    const updated = [...concorrentes];
    (updated[index] as any)[field] = value;
    setConcorrentes(updated);
  };

  const handleCadastroProdutoSuccess = async (productId: string) => {
    await fetchProducts();
    if (currentProductIndex !== null) {
      updateProduto(currentProductIndex, 'product_id', productId);
    }
    setCurrentProductIndex(null);
  };

  const onSubmit = async () => {
    setLoading(true);
    try {
      // Validar produtos
      for (const produto of produtosAuditoria) {
        if (!produto.product_id) {
          toast({ title: "Erro", description: "Selecione todos os produtos", variant: "destructive" });
          setLoading(false);
          return;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Inserir cada produto como uma auditoria separada
      const auditsToInsert = produtosAuditoria.map(produto => ({
        visit_id: visitId || null,
        store_id: storeId,
        product_id: produto.product_id,
        produto_ean: produto.produto_ean || null,
        produto_descricao: produto.produto_descricao || null,
        preco_praticado: produto.preco_praticado || null,
        estoque_loja: produto.estoque_loja || null,
        produto_presente: produto.produto_presente,
        quantidade_frentes: produto.quantidade_frentes,
        conforme_planograma: produto.conforme_planograma,
        concorrentes_presentes: concorrentesPresentes,
        concorrentes_detalhes: JSON.parse(JSON.stringify(concorrentesPresentes && concorrentes.length > 0 ? concorrentes : [])),
        observacoes: observacoes || null,
        created_by: user?.id,
      }));

      const { data: insertedData, error } = await supabase
        .from("gondola_audits")
        .insert(auditsToInsert)
        .select();

      if (error) throw error;

      // Se há concorrentes, solicitar análise IA para cada auditoria
      if (concorrentesPresentes && concorrentes.length > 0 && insertedData) {
        for (const audit of insertedData) {
          try {
            await supabase.functions.invoke('analyze-gondola-competition', {
              body: { auditId: audit.id }
            });
          } catch (aiError) {
            console.error('Erro ao solicitar análise IA:', aiError);
          }
        }
      }

      toast({
        title: "Auditoria registrada",
        description: `${produtosAuditoria.length} produto(s) auditado(s) com sucesso.`,
      });

      // Reset
      setProdutosAuditoria([{
        product_id: "",
        produto_ean: "",
        produto_descricao: "",
        preco_praticado: 0,
        estoque_loja: 0,
        produto_presente: true,
        quantidade_frentes: 0,
        conforme_planograma: false,
      }]);
      setConcorrentes([]);
      setConcorrentesPresentes(false);
      setObservacoes("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auditoria de Gôndola</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Adicione até 20 produtos e até 5 concorrentes
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Lista de Produtos */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Produtos ({produtosAuditoria.length}/20)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addProduto}
                disabled={produtosAuditoria.length >= 20}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Produto
              </Button>
            </div>

            {produtosAuditoria.map((produto, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Produto {index + 1}</h4>
                    <div className="flex gap-2">
                      {produtosAuditoria.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProduto(index)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-2">
                      <Label>Produto *</Label>
                      <select
                        value={produto.product_id}
                        onChange={(e) => updateProduto(index, 'product_id', e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Selecione um produto</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku && `(${p.sku})`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setCurrentProductIndex(index);
                        setShowCadastroProduto(true);
                      }}
                      title="Cadastrar novo produto"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Produto Presente</Label>
                    <Switch
                      checked={produto.produto_presente}
                      onCheckedChange={(checked) => updateProduto(index, 'produto_presente', checked)}
                    />
                  </div>

                  {produto.produto_presente && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>EAN</Label>
                          <Input
                            value={produto.produto_ean}
                            onChange={(e) => updateProduto(index, 'produto_ean', e.target.value)}
                            placeholder="Código de barras"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Estoque da Loja</Label>
                          <Input
                            type="number"
                            value={produto.estoque_loja}
                            onChange={(e) => updateProduto(index, 'estoque_loja', parseInt(e.target.value) || 0)}
                            placeholder="Quantidade"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Descrição do Produto</Label>
                        <Textarea
                          value={produto.produto_descricao}
                          onChange={(e) => updateProduto(index, 'produto_descricao', e.target.value)}
                          placeholder="Descrição detalhada do produto"
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Preço Praticado (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={produto.preco_praticado}
                            onChange={(e) => updateProduto(index, 'preco_praticado', parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Quantidade de Frentes</Label>
                          <Input
                            type="number"
                            value={produto.quantidade_frentes}
                            onChange={(e) => updateProduto(index, 'quantidade_frentes', parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Conforme Planograma</Label>
                        <Switch
                          checked={produto.conforme_planograma}
                          onCheckedChange={(checked) => updateProduto(index, 'conforme_planograma', checked)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label>Concorrentes Presentes</Label>
            <Switch
              checked={concorrentesPresentes}
              onCheckedChange={setConcorrentesPresentes}
            />
          </div>

          {concorrentesPresentes && (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Label>Detalhes dos Concorrentes ({concorrentes.length}/5)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addConcorrente}
                  disabled={concorrentes.length >= 5}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              {concorrentes.map((conc, index) => (
                <div key={index} className="space-y-2 border-t pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex-1">
                      <Label>Marca Concorrente</Label>
                      <Input
                        value={conc.nome}
                        onChange={(e) => updateConcorrente(index, "nome", e.target.value)}
                        placeholder="Ex: Marca X"
                      />
                    </div>
                    <div>
                      <Label>Frentes</Label>
                      <Input
                        type="number"
                        value={conc.quantidade_frentes}
                        onChange={(e) => updateConcorrente(index, "quantidade_frentes", parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Produto do Concorrente</Label>
                      <Input
                        value={conc.produto_nome}
                        onChange={(e) => updateConcorrente(index, "produto_nome", e.target.value)}
                        placeholder="Nome do produto"
                      />
                    </div>
                    <div>
                      <Label>Preço Praticado (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={conc.preco_praticado}
                        onChange={(e) => updateConcorrente(index, "preco_praticado", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeConcorrente(index)}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remover
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações Gerais</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais sobre a auditoria..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button onClick={onSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Auditoria
            </Button>
          </div>
        </div>

        <CadastroRapidoProdutoDialog
          open={showCadastroProduto}
          onOpenChange={setShowCadastroProduto}
          onSuccess={handleCadastroProdutoSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
