import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TradeFilters } from "@/components/trade/TradeFilters";
import { NovoSellOutMultiprodutos } from "@/components/trade/NovoSellOutMultiprodutos";
import { GerenciarProdutosLojaDialog } from "@/components/trade/GerenciarProdutosLojaDialog";
import { TradePageHeader } from "@/components/trade/TradePageHeader";
import { 
  Plus, Package, DollarSign, TrendingUp, 
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_sellouts' }, () => fetchSellouts())
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
        description: "Escolha uma loja antes de registrar",
        variant: "destructive",
      });
      return;
    }
    setDialogOpen(true);
  };

  // KPIs
  const totalQuantity = filteredSellouts.reduce((sum, s) => sum + s.quantity, 0);
  const totalRevenue = filteredSellouts.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const avgTicket = filteredSellouts.length > 0 ? totalRevenue / filteredSellouts.length : 0;
  const totalTransactions = filteredSellouts.length;

  // Chart data
  const salesByDay = filteredSellouts.reduce((acc, s) => {
    const date = format(new Date(s.sale_date), "dd/MM", { locale: ptBR });
    if (!acc[date]) acc[date] = { date, quantidade: 0, valor: 0 };
    acc[date].quantidade += s.quantity;
    acc[date].valor += s.total_amount || 0;
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(salesByDay).slice(-7);

  const productSales = filteredSellouts.reduce((acc, s) => {
    const product = s.store_products?.product_name || "Sem nome";
    if (!acc[product]) acc[product] = { name: product, value: 0 };
    acc[product].value += s.quantity;
    return acc;
  }, {} as Record<string, any>);

  const topProducts = Object.values(productSales).sort((a: any, b: any) => b.value - a.value).slice(0, 5);
  const COLORS = ['hsl(25, 95%, 53%)', 'hsl(25, 80%, 60%)', 'hsl(25, 70%, 70%)', 'hsl(25, 60%, 75%)', 'hsl(25, 50%, 80%)'];

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
        <TradePageHeader
          title="Sell Out"
          description="Vendas dos produtos nas lojas"
          actions={
            <>
              <Button 
                variant="outline"
                size="sm"
                className="h-9 text-xs sm:text-sm"
                onClick={() => setProductsDialogOpen(true)}
                disabled={!selectedStore}
              >
                <Settings className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Produtos</span>
              </Button>
              <Button 
                size="sm"
                className="h-9 text-xs sm:text-sm bg-trade hover:bg-trade-dark"
                onClick={openNewSellOutDialog}
                disabled={!selectedStore}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                <span>Novo</span>
              </Button>
            </>
          }
        />

        <TradeFilters
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
          selectedStore={selectedStore}
        />

        {/* KPIs - Grid responsivo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card className="border-l-4 border-l-trade">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Vendido</CardTitle>
              <ShoppingCart className="h-4 w-4 text-trade hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold text-trade">{totalQuantity.toLocaleString('pt-BR')}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">unidades</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-trade">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Faturamento</CardTitle>
              <DollarSign className="h-4 w-4 text-trade hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold text-trade">
                R$ {(totalRevenue / 1000).toFixed(0)}k
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">total</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-trade">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Ticket Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-trade hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold text-trade">
                R$ {avgTicket.toFixed(0)}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">por transação</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-trade">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Transações</CardTitle>
              <BarChart3 className="h-4 w-4 text-trade hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold text-trade">{totalTransactions}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">registros</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts - Stack on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="p-3 sm:p-6 pb-2">
              <CardTitle className="text-sm sm:text-base">Vendas por Dia</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 pt-0">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={35} />
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="quantidade" stroke="hsl(25, 95%, 53%)" name="Qtd" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-6 pb-2">
              <CardTitle className="text-sm sm:text-base">Top 5 Produtos</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 pt-0">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={topProducts}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend for mobile */}
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {topProducts.slice(0, 3).map((p: any, i) => (
                  <div key={i} className="flex items-center gap-1 text-[10px] sm:text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="truncate max-w-[80px]">{p.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sell Out List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-trade" />
          </div>
        ) : filteredSellouts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="p-3 bg-trade-light rounded-full w-fit mx-auto mb-3">
                <Package className="h-6 w-6 text-trade" />
              </div>
              <p className="text-sm text-muted-foreground">
                {sellouts.length === 0 ? "Nenhum sell-out registrado." : "Nenhum resultado com os filtros."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="p-3 sm:p-6 pb-2">
              <CardTitle className="text-sm sm:text-base">Histórico de Sell Out</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-6 pt-0">
              <div className="space-y-2">
                {filteredSellouts.map((sellout) => (
                  <div 
                    key={sellout.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 active:bg-accent/70 transition-colors touch-manipulation"
                  >
                    <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                      <div className="p-2 bg-trade-light rounded-lg hidden sm:flex">
                        <Package className="h-5 w-5 text-trade" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                          <h3 className="font-medium text-sm truncate">
                            {sellout.store_products?.product_name || "Produto sem nome"}
                          </h3>
                          {sellout.store_products?.category && (
                            <Badge variant="secondary" className="text-[10px] h-4 hidden sm:inline-flex">
                              {sellout.store_products.category}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {sellout.stores?.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(sellout.sale_date), "dd/MM/yy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm sm:text-lg font-bold text-trade">
                        {sellout.quantity} un
                      </div>
                      {sellout.total_amount && (
                        <div className="text-[10px] sm:text-sm text-muted-foreground">
                          R$ {sellout.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
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

      <NovoSellOutMultiprodutos
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
