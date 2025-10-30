import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface NovoSellOutMultiprodutosProps {
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

interface SellOutItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  total: number;
}

export const NovoSellOutMultiprodutos = ({ open, onOpenChange, storeId, onSuccess }: NovoSellOutMultiprodutosProps) => {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [saleDate, setSaleDate] = useState<Date>(new Date());
  const [items, setItems] = useState<SellOutItem[]>([]);
  const [orderNumber, setOrderNumber] = useState("");
  const [notes, setNotes] = useState("");
  
  // Item sendo adicionado
  const [currentItem, setCurrentItem] = useState({
    product_id: "",
    quantity: "",
    unit_price: ""
  });

  useEffect(() => {
    if (open && storeId) {
      fetchProducts();
      resetForm();
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

  const handleAddItem = () => {
    if (!currentItem.product_id || !currentItem.quantity) {
      toast.error("Selecione um produto e informe a quantidade");
      return;
    }

    const quantity = parseInt(currentItem.quantity);
    if (quantity <= 0) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }

    const product = products.find(p => p.id === currentItem.product_id);
    if (!product) return;

    if (quantity > product.current_stock) {
      toast.error(`Estoque insuficiente. Disponível: ${product.current_stock}`);
      return;
    }

    // Verificar se produto já foi adicionado
    if (items.find(item => item.product_id === currentItem.product_id)) {
      toast.error("Produto já adicionado ao pedido");
      return;
    }

    const unitPrice = currentItem.unit_price ? parseFloat(currentItem.unit_price) : (product.unit_price || 0);
    const total = unitPrice * quantity;

    const newItem: SellOutItem = {
      id: crypto.randomUUID(),
      product_id: currentItem.product_id,
      product_name: product.product_name,
      quantity: currentItem.quantity,
      unit_price: unitPrice.toString(),
      total
    };

    setItems([...items, newItem]);
    setCurrentItem({ product_id: "", quantity: "", unit_price: "" });
    toast.success("Produto adicionado ao pedido");
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    setCurrentItem(prev => ({
      ...prev,
      product_id: productId,
      unit_price: product?.unit_price?.toString() || ""
    }));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!storeId || items.length === 0) {
      toast.error("Adicione pelo menos um produto ao pedido");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const batchId = crypto.randomUUID();
      const saleDateStr = format(saleDate, "yyyy-MM-dd");

      // Inserir todos os itens do pedido
      const itemsToInsert = items.map(item => ({
        store_id: storeId,
        product_id: item.product_id,
        quantity: parseInt(item.quantity),
        sale_date: saleDateStr,
        unit_price: parseFloat(item.unit_price),
        total_amount: item.total,
        batch_id: batchId,
        order_number: orderNumber || null,
        notes: notes || null,
        created_by: user.id
      }));

      const { error } = await supabase
        .from("store_sellouts")
        .insert(itemsToInsert);

      if (error) throw error;

      toast.success(`Pedido registrado com sucesso! ${items.length} produto(s)`);
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Erro ao registrar pedido:", error);
      toast.error(error.message || "Erro ao registrar pedido");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setItems([]);
    setCurrentItem({ product_id: "", quantity: "", unit_price: "" });
    setOrderNumber("");
    setNotes("");
    setSaleDate(new Date());
  };

  const selectedProduct = products.find(p => p.id === currentItem.product_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Novo Pedido Sell Out
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cabeçalho do Pedido */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="order_number">Número do Pedido</Label>
              <Input
                id="order_number"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Ex: PED-001"
              />
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
                    {saleDate ? format(saleDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
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
          </div>

          {/* Adicionar Item */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h3 className="font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Produto
            </h3>
            
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-5 space-y-2">
                <Label htmlFor="product">Produto</Label>
                <Select
                  value={currentItem.product_id}
                  onValueChange={handleProductChange}
                >
                  <SelectTrigger id="product">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.filter(p => !items.find(item => item.product_id === p.id)).map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.product_name} {product.product_code && `(${product.product_code})`}
                        <span className="text-xs text-muted-foreground ml-2">
                          Est: {product.current_stock}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground">
                    Estoque: <strong>{selectedProduct.current_stock}</strong> un
                  </p>
                )}
              </div>

              <div className="col-span-3 space-y-2">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={currentItem.quantity}
                  onChange={(e) => setCurrentItem(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>

              <div className="col-span-3 space-y-2">
                <Label htmlFor="unit_price">Preço Un. (R$)</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentItem.unit_price}
                  onChange={(e) => setCurrentItem(prev => ({ ...prev, unit_price: e.target.value }))}
                  placeholder="0,00"
                />
              </div>

              <div className="col-span-1 flex items-end">
                <Button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full"
                  disabled={!currentItem.product_id || !currentItem.quantity}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Lista de Itens */}
          {items.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Itens do Pedido ({items.length})</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Preço Un.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product_name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          R$ {parseFloat(item.unit_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={3} className="text-right">Total do Pedido:</TableCell>
                      <TableCell className="text-right text-lg">
                        R$ {calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais sobre o pedido..."
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
            <Button type="submit" disabled={loading || items.length === 0}>
              {loading ? "Registrando..." : `Registrar Pedido (${items.length} ${items.length === 1 ? 'item' : 'itens'})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
