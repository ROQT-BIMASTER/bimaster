import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface GerenciarProdutosLojaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string | null;
}

interface Product {
  id: string;
  product_name: string;
  product_code: string | null;
  category: string | null;
  brand: string | null;
  current_stock: number;
  unit_price: number | null;
}

export const GerenciarProdutosLojaDialog = ({ 
  open, 
  onOpenChange, 
  storeId 
}: GerenciarProdutosLojaDialogProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formData, setFormData] = useState({
    product_name: "",
    product_code: "",
    category: "",
    brand: "",
    current_stock: "",
    unit_price: ""
  });

  useEffect(() => {
    if (open && storeId) {
      fetchProducts();
    }
  }, [open, storeId]);

  const fetchProducts = async () => {
    if (!storeId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("store_products")
        .select("*")
        .eq("store_id", storeId)
        .order("product_name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!storeId || !formData.product_name) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    const stock = parseInt(formData.current_stock) || 0;
    const price = formData.unit_price ? parseFloat(formData.unit_price) : null;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (editingId) {
        // Atualizar produto existente
        const { error } = await supabase
          .from("store_products")
          .update({
            product_name: formData.product_name,
            product_code: formData.product_code || null,
            category: formData.category || null,
            brand: formData.brand || null,
            current_stock: stock,
            unit_price: price
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Produto atualizado com sucesso!");
      } else {
        // Criar novo produto
        const { error } = await supabase
          .from("store_products")
          .insert({
            store_id: storeId,
            product_name: formData.product_name,
            product_code: formData.product_code || null,
            category: formData.category || null,
            brand: formData.brand || null,
            current_stock: stock,
            unit_price: price,
            created_by: user.id
          });

        if (error) throw error;
        toast.success("Produto adicionado com sucesso!");
      }

      resetForm();
      fetchProducts();
    } catch (error: any) {
      console.error("Erro ao salvar produto:", error);
      toast.error(error.message || "Erro ao salvar produto");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setFormData({
      product_name: product.product_name,
      product_code: product.product_code || "",
      category: product.category || "",
      brand: product.brand || "",
      current_stock: product.current_stock.toString(),
      unit_price: product.unit_price?.toString() || ""
    });
    setEditingId(product.id);
    setShowNewForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("store_products")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Produto excluído com sucesso!");
      fetchProducts();
    } catch (error: any) {
      console.error("Erro ao excluir produto:", error);
      toast.error(error.message || "Erro ao excluir produto");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      product_name: "",
      product_code: "",
      category: "",
      brand: "",
      current_stock: "",
      unit_price: ""
    });
    setEditingId(null);
    setShowNewForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Produtos da Loja</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showNewForm && (
            <Button onClick={() => setShowNewForm(true)} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Produto
            </Button>
          )}

          {showNewForm && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="product_name">Nome do Produto *</Label>
                      <Input
                        id="product_name"
                        value={formData.product_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
                        placeholder="Ex: Refrigerante Coca-Cola 2L"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product_code">Código</Label>
                      <Input
                        id="product_code"
                        value={formData.product_code}
                        onChange={(e) => setFormData(prev => ({ ...prev, product_code: e.target.value }))}
                        placeholder="Ex: COCA-2L"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Categoria</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        placeholder="Ex: Bebidas"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="brand">Marca</Label>
                      <Input
                        id="brand"
                        value={formData.brand}
                        onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                        placeholder="Ex: Coca-Cola"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="current_stock">Estoque Inicial</Label>
                      <Input
                        id="current_stock"
                        type="number"
                        min="0"
                        value={formData.current_stock}
                        onChange={(e) => setFormData(prev => ({ ...prev, current_stock: e.target.value }))}
                        placeholder="Ex: 100"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="unit_price">Preço Unitário (R$)</Label>
                      <Input
                        id="unit_price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.unit_price}
                        onChange={(e) => setFormData(prev => ({ ...prev, unit_price: e.target.value }))}
                        placeholder="Ex: 8.50"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={loading} className="flex-1">
                      <Save className="mr-2 h-4 w-4" />
                      {editingId ? "Atualizar" : "Adicionar"}
                    </Button>
                    <Button variant="outline" onClick={resetForm} disabled={loading}>
                      <X className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold">Produtos Cadastrados ({products.length})</h3>
            
            {loading && !showNewForm ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando produtos...
              </div>
            ) : products.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum produto cadastrado ainda
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {products.map((product) => (
                  <Card key={product.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{product.product_name}</h4>
                            {product.product_code && (
                              <Badge variant="outline">{product.product_code}</Badge>
                            )}
                            {product.category && (
                              <Badge variant="secondary">{product.category}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {product.brand && <span>Marca: {product.brand}</span>}
                            <span>Estoque: <strong>{product.current_stock}</strong> un</span>
                            {product.unit_price && (
                              <span>Preço: <strong>R$ {product.unit_price.toFixed(2)}</strong></span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(product)}
                            disabled={loading}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(product.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
