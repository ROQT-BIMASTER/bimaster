import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, TrendingUp, DollarSign, ShoppingCart, CheckCircle, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";

interface Store {
  id: string;
  name: string;
  code: string;
}

interface Prospect {
  id: string;
  nome_empresa: string;
}

interface Campaign {
  id: string;
  name: string;
  code: string;
}

interface Sale {
  id: string;
  sale_code: string;
  sale_date: string;
  total_value: number;
  net_value: number;
  status: string;
  store_id?: string;
  prospect_id?: string;
  stores?: { name: string };
  prospects?: { nome_empresa: string };
}

interface SaleItem {
  product_name: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  total_value: number;
  unit_of_measure: string;
}

export default function TradeVendas() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Form state
  const [saleCode, setSaleCode] = useState("");
  const [saleDate, setSaleDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedProspect, setSelectedProspect] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [notes, setNotes] = useState("");
  
  // Sale items state
  const [items, setItems] = useState<SaleItem[]>([{
    product_name: "",
    product_code: "",
    quantity: 1,
    unit_price: 0,
    discount_percentage: 0,
    total_value: 0,
    unit_of_measure: "UN"
  }]);

  // Stats state
  const [stats, setStats] = useState({
    totalSales: 0,
    totalValue: 0,
    avgTicket: 0,
    thisMonthSales: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch sales
      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select(`
          *,
          stores(name),
          prospects(nome_empresa)
        `)
        .order("sale_date", { ascending: false });

      if (salesError) throw salesError;
      setSales(salesData || []);

      // Calculate stats
      const total = salesData?.reduce((acc, sale) => acc + Number(sale.net_value || 0), 0) || 0;
      const count = salesData?.length || 0;
      const thisMonth = salesData?.filter(s => {
        const saleDate = new Date(s.sale_date);
        const now = new Date();
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      }).length || 0;

      setStats({
        totalSales: count,
        totalValue: total,
        avgTicket: count > 0 ? total / count : 0,
        thisMonthSales: thisMonth,
      });

      // Fetch stores - desestruturando e usando type assertion explícita
      const storesQuery = await supabase
        .from("stores")
        .select("id, name, code")
        .eq("status", "active")
        .order("name");
      
      if (storesQuery.data) {
        setStores(storesQuery.data as Store[]);
      }

      // Fetch prospects
      const prospectsQuery = await supabase
        .from("prospects")
        .select("id, nome_empresa")
        .order("nome_empresa");
      
      if (prospectsQuery.data) {
        setProspects(prospectsQuery.data as Prospect[]);
      }

      // Fetch campaigns
      const campaignsQuery = await supabase
        .from("trade_campaigns")
        .select("id, name, code")
        .eq("status", "active")
        .order("name");
      
      if (campaignsQuery.data) {
        setCampaigns(campaignsQuery.data as Campaign[]);
      }

    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, {
      product_name: "",
      product_code: "",
      quantity: 1,
      unit_price: 0,
      discount_percentage: 0,
      total_value: 0,
      unit_of_measure: "UN"
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof SaleItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate total
    const quantity = Number(newItems[index].quantity);
    const unitPrice = Number(newItems[index].unit_price);
    const discount = Number(newItems[index].discount_percentage);
    const subtotal = quantity * unitPrice;
    newItems[index].total_value = subtotal - (subtotal * discount / 100);
    
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!saleCode || !saleDate) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (!selectedStore && !selectedProspect) {
      toast({
        title: "Erro",
        description: "Selecione uma loja ou prospect",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0 || !items[0].product_name) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um item à venda",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Calculate totals
      const totalValue = items.reduce((acc, item) => acc + Number(item.total_value), 0);
      const discountValue = items.reduce((acc, item) => {
        const subtotal = Number(item.quantity) * Number(item.unit_price);
        return acc + (subtotal * Number(item.discount_percentage) / 100);
      }, 0);

      // Insert sale
      const { data: saleData, error: saleError } = await supabase
        .from("sales")
        .insert({
          sale_code: saleCode,
          sale_date: saleDate,
          store_id: selectedStore || null,
          prospect_id: selectedProspect || null,
          campaign_id: selectedCampaign || null,
          salesperson_id: user.id,
          total_value: totalValue + discountValue,
          discount_value: discountValue,
          net_value: totalValue,
          payment_method: paymentMethod || null,
          payment_terms: paymentTerms || null,
          notes: notes || null,
          created_by: user.id,
          status: "pending",
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Insert sale items
      const itemsToInsert = items.map(item => ({
        sale_id: saleData.id,
        product_name: item.product_name,
        product_code: item.product_code || null,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        discount_percentage: Number(item.discount_percentage),
        total_value: Number(item.total_value),
        unit_of_measure: item.unit_of_measure,
      }));

      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({
        title: "Sucesso",
        description: "Venda registrada com sucesso",
      });

      setIsDialogOpen(false);
      resetForm();
      fetchData();

    } catch (error: any) {
      console.error("Erro ao criar venda:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível registrar a venda",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setSaleCode("");
    setSaleDate(format(new Date(), "yyyy-MM-dd"));
    setSelectedStore("");
    setSelectedProspect("");
    setSelectedCampaign("");
    setPaymentMethod("");
    setPaymentTerms("");
    setNotes("");
    setItems([{
      product_name: "",
      product_code: "",
      quantity: 1,
      unit_price: 0,
      discount_percentage: 0,
      total_value: 0,
      unit_of_measure: "UN"
    }]);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: "outline",
      approved: "default",
      completed: "default",
      rejected: "destructive",
      cancelled: "secondary",
    };
    
    const labels: Record<string, string> = {
      pending: "Pendente",
      approved: "Aprovada",
      completed: "Concluída",
      rejected: "Rejeitada",
      cancelled: "Cancelada",
    };

    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p>Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Vendas</h1>
          <p className="text-muted-foreground">Gerencie e acompanhe todas as vendas</p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSales}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(stats.totalValue)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(stats.avgTicket)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas Este Mês</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.thisMonthSales}</div>
            </CardContent>
          </Card>
        </div>

        {/* Nova Venda Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Nova Venda</DialogTitle>
              <DialogDescription>Preencha os dados da venda</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sale_code">Código da Venda *</Label>
                  <Input
                    id="sale_code"
                    value={saleCode}
                    onChange={(e) => setSaleCode(e.target.value)}
                    placeholder="EX: VENDA-001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sale_date">Data da Venda *</Label>
                  <Input
                    id="sale_date"
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="store">Loja</Label>
                  <Select value={selectedStore} onValueChange={setSelectedStore}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma loja" />
                    </SelectTrigger>
                    <SelectContent>
                    {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name} ({store.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prospect">Prospect</Label>
                  <Select value={selectedProspect} onValueChange={setSelectedProspect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um prospect" />
                    </SelectTrigger>
                    <SelectContent>
                    {prospects.map((prospect) => (
                        <SelectItem key={prospect.id} value={prospect.id}>
                          {prospect.nome_empresa}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign">Campanha (opcional)</Label>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name} ({campaign.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_method">Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                      <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="bank_slip">Boleto</SelectItem>
                      <SelectItem value="bank_transfer">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Condições de Pagamento</Label>
                  <Input
                    id="payment_terms"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="Ex: 30/60/90 dias"
                  />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Itens da Venda *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Item
                  </Button>
                </div>

                <div className="space-y-2">
                  {items.map((item, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-6 gap-2">
                          <div className="col-span-2">
                            <Input
                              placeholder="Nome do produto *"
                              value={item.product_name}
                              onChange={(e) => updateItem(index, "product_name", e.target.value)}
                              required
                            />
                          </div>
                          <Input
                            placeholder="Código"
                            value={item.product_code}
                            onChange={(e) => updateItem(index, "product_code", e.target.value)}
                          />
                          <Input
                            type="number"
                            placeholder="Qtd"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", e.target.value)}
                            min="0"
                            step="0.01"
                          />
                          <Input
                            type="number"
                            placeholder="Preço"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                            min="0"
                            step="0.01"
                          />
                          <div className="flex gap-1">
                            <Input
                              type="number"
                              placeholder="Desc %"
                              value={item.discount_percentage}
                              onChange={(e) => updateItem(index, "discount_percentage", e.target.value)}
                              min="0"
                              max="100"
                              step="0.01"
                            />
                            {items.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-right">
                          Total: R$ {item.total_value.toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold">
                    Total Geral: R$ {items.reduce((acc, item) => acc + item.total_value, 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações sobre a venda"
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Registrar Venda</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Lista de Vendas */}
        <Card>
          <CardHeader>
            <CardTitle>Últimas Vendas</CardTitle>
            <CardDescription>Histórico de vendas registradas</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Valor Líquido</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma venda registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.sale_code}</TableCell>
                      <TableCell>{format(new Date(sale.sale_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        {sale.stores?.name || sale.prospects?.nome_empresa || "-"}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(sale.total_value)}
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(sale.net_value)}
                      </TableCell>
                      <TableCell>{getStatusBadge(sale.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
