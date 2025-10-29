import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface NovoSellOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string | null;
  onSuccess: () => void;
}

interface Product {
  id: string;
  product_name: string;
  product_code: string | null;
  current_stock: number;
  unit_price: number | null;
}

export const NovoSellOutDialog = ({ open, onOpenChange, storeId, onSuccess }: NovoSellOutDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [saleDate, setSaleDate] = useState<Date>(new Date());
  const [formData, setFormData] = useState({
    product_id: "",
    quantity: "",
    unit_price: "",
    notes: ""
  });

  useEffect(() => {
    if (open && storeId) {
      fetchProducts();
    }
  }, [open, storeId]);

  const fetchProducts = async () => {
    if (!storeId) return;

    try {
      const { data, error } = await supabase
        .from("store_products")
        .select("id, product_name, product_code, current_stock, unit_price")
        .eq("store_id", storeId)
        .order("product_name");

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar produtos");
    }
  };

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    setFormData(prev => ({
      ...prev,
      product_id: productId,
      unit_price: product?.unit_price?.toString() || ""
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!storeId || !formData.product_id) {
      toast.error("Selecione um produto");
      return;
    }

    const quantity = parseInt(formData.quantity);
    if (!quantity || quantity <= 0) {
      toast.error("Informe uma quantidade válida");
      return;
    }

    const product = products.find(p => p.id === formData.product_id);
    if (product && quantity > product.current_stock) {
      toast.error(`Estoque insuficiente. Disponível: ${product.current_stock} unidades`);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const unitPrice = formData.unit_price ? parseFloat(formData.unit_price) : null;
      const totalAmount = unitPrice ? unitPrice * quantity : null;

      const { error } = await supabase
        .from("store_sellouts")
        .insert({
          store_id: storeId,
          product_id: formData.product_id,
          quantity,
          sale_date: format(saleDate, "yyyy-MM-dd"),
          unit_price: unitPrice,
          total_amount: totalAmount,
          notes: formData.notes || null,
          created_by: user.id
        });

      if (error) throw error;

      toast.success("Sell-out registrado com sucesso!");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Erro ao registrar sell-out:", error);
      toast.error(error.message || "Erro ao registrar sell-out");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      product_id: "",
      quantity: "",
      unit_price: "",
      notes: ""
    });
    setSaleDate(new Date());
  };

  const selectedProduct = products.find(p => p.id === formData.product_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Sell Out</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product">Produto *</Label>
            <Select
              value={formData.product_id}
              onValueChange={handleProductChange}
              required
            >
              <SelectTrigger id="product">
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    Nenhum produto cadastrado para esta loja
                  </div>
                ) : (
                  products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>
                          {product.product_name}
                          {product.product_code && ` (${product.product_code})`}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          Estoque: {product.current_stock}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedProduct && (
              <p className="text-sm text-muted-foreground">
                Estoque disponível: <strong>{selectedProduct.current_stock}</strong> unidades
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade Vendida *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="Ex: 10"
                required
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
                placeholder="Ex: 15.90"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data da Venda *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !saleDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {saleDate ? format(saleDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={saleDate}
                  onSelect={(date) => date && setSaleDate(date)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {formData.unit_price && formData.quantity && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium">Valor Total da Venda</p>
              <p className="text-2xl font-bold">
                R$ {(parseFloat(formData.unit_price) * parseInt(formData.quantity || "0")).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Informações adicionais sobre a venda..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Registrar Sell Out"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
