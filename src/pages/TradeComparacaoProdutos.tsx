import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Package, TrendingUp, Image as ImageIcon, Trash2 } from "lucide-react";
import { NossoProdutoDialog } from "@/components/trade/NossoProdutoDialog";
import { ProdutoConcorrenteDialog } from "@/components/trade/ProdutoConcorrenteDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OurProduct {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  photos: string[];
  created_at: string;
}

interface CompetitorProduct {
  id: string;
  product_name: string;
  category: string | null;
  price: number | null;
  description: string | null;
  photos: string[];
  market_presence: string | null;
  competitors: {
    name: string;
    brand: string | null;
  };
}

export default function TradeComparacaoProdutos() {
  const [ourProducts, setOurProducts] = useState<OurProduct[]>([]);
  const [competitorProducts, setCompetitorProducts] = useState<CompetitorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNossoProduto, setShowNossoProduto] = useState(false);
  const [showProdutoConcorrente, setShowProdutoConcorrente] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ourData, compData] = await Promise.all([
        supabase
          .from("our_products")
          .select("*")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("competitor_products")
          .select(`
            *,
            competitors (name, brand)
          `)
          .eq("active", true)
          .order("created_at", { ascending: false })
      ]);

      if (ourData.data) setOurProducts(ourData.data as any);
      if (compData.data) setCompetitorProducts(compData.data as any);
    } catch (error: any) {
      toast.error("Erro ao carregar dados");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const deleteOurProduct = async (id: string) => {
    if (!confirm("Confirma a exclusão deste produto?")) return;

    try {
      const { error } = await supabase
        .from("our_products")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Produto removido");
      fetchData();
    } catch (error) {
      toast.error("Erro ao remover produto");
    }
  };

  const deleteCompetitorProduct = async (id: string) => {
    if (!confirm("Confirma a exclusão deste produto?")) return;

    try {
      const { error } = await supabase
        .from("competitor_products")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Produto removido");
      fetchData();
    } catch (error) {
      toast.error("Erro ao remover produto");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Comparação de Produtos</h1>
            <p className="text-muted-foreground">
              Gerencie até 20 produtos próprios e produtos de até 5 concorrentes
            </p>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Nossos Produtos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ourProducts.length}/20</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Produtos Concorrentes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{competitorProducts.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Fotos</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {ourProducts.reduce((acc, p) => acc + (p.photos?.length || 0), 0) +
                  competitorProducts.reduce((acc, p) => acc + (p.photos?.length || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="nossos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="nossos">Nossos Produtos</TabsTrigger>
            <TabsTrigger value="concorrentes">Produtos Concorrentes</TabsTrigger>
          </TabsList>

          <TabsContent value="nossos" className="space-y-4">
            <div className="flex justify-end">
              <Button 
                onClick={() => setShowNossoProduto(true)}
                disabled={ourProducts.length >= 20}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto {ourProducts.length >= 20 && "(Limite atingido)"}
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : ourProducts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    Nenhum produto cadastrado. Adicione até 20 produtos para comparação.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ourProducts.map((product) => (
                  <Card key={product.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          {product.sku && (
                            <Badge variant="outline" className="mt-1">{product.sku}</Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteOurProduct(product.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {product.category && (
                        <Badge variant="secondary">{product.category}</Badge>
                      )}
                      
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      {product.photos && product.photos.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {product.photos.length} foto(s)
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {product.photos.slice(0, 3).map((photo, idx) => (
                              <img
                                key={idx}
                                src={photo}
                                alt={`${product.name} ${idx + 1}`}
                                className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-80"
                                onClick={() => window.open(photo, '_blank')}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="concorrentes" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowProdutoConcorrente(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto Concorrente
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : competitorProducts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    Nenhum produto concorrente cadastrado.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {competitorProducts.map((product) => (
                  <Card key={product.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{product.product_name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {product.competitors.name}
                            {product.competitors.brand && ` - ${product.competitors.brand}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCompetitorProduct(product.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2 flex-wrap">
                        {product.category && (
                          <Badge variant="secondary">{product.category}</Badge>
                        )}
                        {product.market_presence && (
                          <Badge variant="outline">
                            Presença: {product.market_presence}
                          </Badge>
                        )}
                      </div>

                      {product.price && (
                        <p className="text-lg font-semibold">
                          R$ {product.price.toFixed(2)}
                        </p>
                      )}
                      
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      {product.photos && product.photos.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {product.photos.length} foto(s)
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {product.photos.slice(0, 3).map((photo, idx) => (
                              <img
                                key={idx}
                                src={photo}
                                alt={`${product.product_name} ${idx + 1}`}
                                className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-80"
                                onClick={() => window.open(photo, '_blank')}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <NossoProdutoDialog
        open={showNossoProduto}
        onOpenChange={setShowNossoProduto}
        onSuccess={fetchData}
      />

      <ProdutoConcorrenteDialog
        open={showProdutoConcorrente}
        onOpenChange={setShowProdutoConcorrente}
        onSuccess={fetchData}
      />
    </DashboardLayout>
  );
}
