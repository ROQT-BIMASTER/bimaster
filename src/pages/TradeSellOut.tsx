import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TradeFilters } from "@/components/trade/TradeFilters";
import { NovoSellOutDialog } from "@/components/trade/NovoSellOutDialog";
import { GerenciarProdutosLojaDialog } from "@/components/trade/GerenciarProdutosLojaDialog";
import { 
  Plus, Package, DollarSign, TrendingUp, TrendingDown, 
  ShoppingCart, BarChart3, Calendar, Settings 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

interface SellOut {
  id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  sale_date: string;
  unit_price: number | null;
  total_amount: number | null;
  notes: string | null;
  created_at: string;
  store_products: {
    product_name: string;
    product_code: string | null;
    category: string | null;
  } | null;
  stores: {
    name: string;
    code: string;
  } | null;
}

export default function TradeSellOut() {
  const [sellouts, setSellouts] = useState<SellOut[]>([]);
  const [filteredSellouts, setFilteredSellouts] = useState<SellOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productsDialogOpen, setProductsDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const { toast } = useToast();

  useEffect(() => {
    fetchSellouts();

    const channel = supabase
      .channel('sellouts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'store_sellouts'
        },
        () => {
          fetchSellouts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [sellouts, selectedStore, aiCriteria, dateRange]);

  const applyFilters = () => {
    let filtered = [...sellouts];

    if (selectedStore) {
      filtered = filtered.filter(s => s.store_id === selectedStore);
    }

    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(s => {
        const saleDate = new Date(s.sale_date);
        return saleDate >= new Date(dateRange.start) && saleDate <= new Date(dateRange.end);
      });
    }

    if (aiCriteria) {
      // Implementar lógica de filtro IA conforme critérios retornados
    }

    setFilteredSellouts(filtered);
  };

  const fetchSellouts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("store_sellouts")
        .select(`
          *,
          store_products (product_name, product_code, category),
          stores (name, code)
        `)
        .order("sale_date", { ascending: false });

      if (error) throw error;
      setSellouts(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openNewSellOutDialog = () => {
    if (!selectedStore) {
      toast({
        title: "Selecione uma loja",
        description: "Escolha uma loja antes de registrar um sell-out",
        variant: "destructive",
      });
      return;
    }
    setDialogOpen(true);
  };

  // Cálculos de KPIs
  const totalQuantity = filteredSellouts.reduce((sum, s) => sum + s.quantity, 0);
  const totalRevenue = filteredSellouts.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const avgTicket = filteredSellouts.length > 0 ? totalRevenue / filteredSellouts.length : 0;
  const totalTransactions = filteredSellouts.length;

  // Dados para gráficos
  const salesByDay = filteredSellouts.reduce((acc, s) => {
    const date = format(new Date(s.sale_date), "dd/MM", { locale: ptBR });
    if (!acc[date]) {
      acc[date] = { date, quantidade: 0, valor: 0 };
    }
    acc[date].quantidade += s.quantity;
    acc[date].valor += s.total_amount || 0;
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(salesByDay).slice(-7);

  const productSales = filteredSellouts.reduce((acc, s) => {
    const product = s.store_products?.product_name || "Sem nome";
    if (!acc[product]) {
      acc[product] = { name: product, value: 0 };
    }
    acc[product].value += s.quantity;
    return acc;
  }, {} as Record<string, any>);

  const topProducts = Object.values(productSales)
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 5);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Sell Out</h1>
            <p className="text-muted-foreground">
              Gerencie e analise as vendas dos produtos nas lojas
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setProductsDialogOpen(true)}
              disabled={!selectedStore}
            >
              <Settings className="mr-2 h-4 w-4" />
              Gerenciar Produtos
            </Button>
            <Button onClick={openNewSellOutDialog} disabled={!selectedStore}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Sell Out
            </Button>
          </div>
        </div>

        <TradeFilters
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
          selectedStore={selectedStore}
        />

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalQuantity.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-muted-foreground">unidades</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">por transação</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transações</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTransactions}</div>
              <p className="text-xs text-muted-foreground">registros</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Vendas por Dia (Últimos 7 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="quantidade" 
                    stroke="#8884d8" 
                    name="Quantidade" 
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="#82ca9d" 
                    name="Valor (R$)" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 5 Produtos Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topProducts}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Sell Outs */}
        {loading ? (
          <div className="text-center py-8">Carregando sell-outs...</div>
        ) : filteredSellouts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                {sellouts.length === 0 
                  ? "Nenhum sell-out registrado ainda."
                  : "Nenhum sell-out encontrado com os filtros aplicados."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Sell Out</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredSellouts.map((sellout) => (
                  <div 
                    key={sellout.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Package className="h-8 w-8 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {sellout.store_products?.product_name || "Produto sem nome"}
                          </h3>
                          {sellout.store_products?.product_code && (
                            <Badge variant="outline">
                              {sellout.store_products.product_code}
                            </Badge>
                          )}
                          {sellout.store_products?.category && (
                            <Badge variant="secondary">
                              {sellout.store_products.category}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {sellout.stores?.name} ({sellout.stores?.code})
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {format(new Date(sellout.sale_date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {sellout.quantity} un
                      </div>
                      {sellout.total_amount && (
                        <div className="text-sm text-muted-foreground">
                          R$ {sellout.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      )}
                      {sellout.unit_price && (
                        <div className="text-xs text-muted-foreground">
                          R$ {sellout.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / un
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <NovoSellOutDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        storeId={selectedStore}
        onSuccess={fetchSellouts}
      />

      <GerenciarProdutosLojaDialog
        open={productsDialogOpen}
        onOpenChange={setProductsDialogOpen}
        storeId={selectedStore}
      />
    </DashboardLayout>
  );
}
