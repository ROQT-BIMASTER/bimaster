import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuditoriaGondolaDialog } from "@/components/trade/AuditoriaGondolaDialog";
import { TradeFilters } from "@/components/trade/TradeFilters";
import { Plus, Store, Package, TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Auditoria {
  id: string;
  store_id: string;
  created_at: string;
  preco_praticado: number | null;
  produto_presente: boolean;
  quantidade_frentes: number;
  conforme_planograma: boolean;
  concorrentes_presentes: boolean;
  concorrentes_detalhes: any;
  observacoes: string | null;
  stores: {
    name: string;
    code: string;
  } | null;
  products: {
    name: string;
    sku: string;
    price_reference: number | null;
  } | null;
  visits: {
    visit_code: string;
  } | null;
}

export default function TradeAuditorias() {
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [filteredAuditorias, setFilteredAuditorias] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAuditorias();

    const channel = supabase
      .channel('gondola-audits-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gondola_audits'
        },
        () => {
          fetchAuditorias();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [auditorias, selectedStore, aiCriteria]);

  const applyFilters = () => {
    let filtered = [...auditorias];

    if (selectedStore) {
      filtered = filtered.filter(a => a.store_id === selectedStore);
    }

    if (aiCriteria) {
      // Implementar lógica de filtro IA conforme critérios retornados
    }

    setFilteredAuditorias(filtered);
  };

  const fetchAuditorias = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("gondola_audits")
        .select(`
          *,
          stores (name, code),
          products (name, sku, price_reference),
          visits (visit_code)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAuditorias(data || []);
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

  const openNewAuditDialog = () => {
    if (!selectedStore) {
      toast({
        title: "Selecione uma loja",
        description: "Escolha uma loja antes de criar uma auditoria",
        variant: "destructive",
      });
      return;
    }
    setDialogOpen(true);
  };

  const renderVariacaoPreco = (preco: number | null, referencia: number | null) => {
    if (!preco || !referencia) return null;
    
    const variacao = ((preco - referencia) / referencia) * 100;
    const isPositive = variacao > 0;
    
    return (
      <div className="flex items-center gap-1">
        {isPositive ? (
          <TrendingUp className="h-4 w-4 text-destructive" />
        ) : (
          <TrendingDown className="h-4 w-4 text-green-600" />
        )}
        <span className={isPositive ? "text-destructive" : "text-green-600"}>
          {isPositive ? "+" : ""}{variacao.toFixed(1)}%
        </span>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Auditoria de Gôndola</h1>
            <p className="text-muted-foreground">
              Gerencie auditorias de preço, ruptura e planograma
            </p>
          </div>
          <Button onClick={openNewAuditDialog} disabled={!selectedStore}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Auditoria
          </Button>
        </div>

        <TradeFilters
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
          selectedStore={selectedStore}
        />

        {loading ? (
          <div className="text-center py-8">Carregando auditorias...</div>
        ) : filteredAuditorias.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                {auditorias.length === 0 
                  ? "Nenhuma auditoria registrada ainda."
                  : "Nenhuma auditoria encontrada com os filtros aplicados."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredAuditorias.map((audit) => (
              <Card key={audit.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        {audit.products?.name}
                        {audit.products?.sku && (
                          <Badge variant="outline">{audit.products.sku}</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Store className="h-4 w-4" />
                        {audit.stores?.name} ({audit.stores?.code})
                        {audit.visits && (
                          <Badge variant="secondary">{audit.visits.visit_code}</Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(audit.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <div className="flex items-center gap-2 mt-1">
                        {audit.produto_presente ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Presente
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Ruptura
                          </Badge>
                        )}
                      </div>
                    </div>

                    {audit.produto_presente && (
                      <>
                        <div>
                          <p className="text-sm text-muted-foreground">Preço</p>
                          <p className="text-lg font-semibold mt-1">
                            {audit.preco_praticado 
                              ? `R$ ${audit.preco_praticado.toFixed(2)}`
                              : "-"}
                          </p>
                          {renderVariacaoPreco(audit.preco_praticado, audit.products?.price_reference)}
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground">Frentes</p>
                          <p className="text-lg font-semibold mt-1">
                            {audit.quantidade_frentes}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground">Planograma</p>
                          <div className="mt-1">
                            {audit.conforme_planograma ? (
                              <Badge variant="default" className="bg-green-600">Conforme</Badge>
                            ) : (
                              <Badge variant="destructive">Não Conforme</Badge>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {audit.concorrentes_presentes && Array.isArray(audit.concorrentes_detalhes) && (
                      <div className="col-span-2 md:col-span-4">
                        <p className="text-sm text-muted-foreground mb-2">Concorrentes</p>
                        <div className="flex flex-wrap gap-2">
                          {(audit.concorrentes_detalhes as any[]).map((conc: any, idx: number) => (
                            <Badge key={idx} variant="outline">
                              {conc.nome} ({conc.quantidade_frentes} frentes)
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {audit.observacoes && (
                      <div className="col-span-2 md:col-span-4">
                        <p className="text-sm text-muted-foreground">Observações</p>
                        <p className="text-sm mt-1">{audit.observacoes}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AuditoriaGondolaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        storeId={selectedStore}
        onSuccess={fetchAuditorias}
      />
    </DashboardLayout>
  );
}
