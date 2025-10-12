import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Upload, Search, MapPin, Edit, Eye } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { NovaLojaDialog } from "@/components/trade/NovaLojaDialog";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { TradeFilters } from "@/components/trade/TradeFilters";
import { StoreDetailDialog } from "@/components/trade/StoreDetailDialog";

interface Store {
  id: string;
  code: string;
  name: string;
  chain: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  priority: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
}

const TradeStores = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovaLoja, setShowNovaLoja] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailStoreId, setDetailStoreId] = useState<string | null>(null);

  if (!permissionsLoading && !hasPermission("trade_stores")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("name");

      if (error) throw error;
      setAllStores(data || []);
      setStores(data || []);
    } catch (error) {
      console.error("Erro ao buscar PDVs:", error);
      toast.error("Erro ao carregar PDVs");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allStores];

    if (selectedStore) {
      filtered = filtered.filter(s => s.id === selectedStore);
    }

    if (aiCriteria) {
      if (aiCriteria.status) {
        filtered = filtered.filter(s => aiCriteria.status.includes(s.status));
      }
      if (aiCriteria.priority) {
        filtered = filtered.filter(s => s.priority === aiCriteria.priority);
      }
      if (aiCriteria.category) {
        filtered = filtered.filter(s => s.category === aiCriteria.category);
      }
    }

    setStores(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [selectedStore, aiCriteria, allStores]);

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case "alta":
        return "destructive";
      case "media":
        return "default";
      case "baixa":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pontos de Venda</h1>
            <p className="text-muted-foreground">
              Gestão de lojas e PDVs
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/dashboard/trade-marketing/import-stores')}>
              <Upload className="mr-2 h-4 w-4" />
              Importar Lojas
            </Button>
            <Button onClick={() => setShowNovaLoja(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Loja
            </Button>
          </div>
        </div>

        <TradeFilters
          selectedStore={selectedStore}
          onStoreChange={setSelectedStore}
          onAIFilter={setAiCriteria}
        />

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Rede</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : stores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Nenhuma loja encontrada
                  </TableCell>
                </TableRow>
              ) : (
                stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.code}</TableCell>
                    <TableCell>{store.name}</TableCell>
                    <TableCell>{store.chain || "-"}</TableCell>
                    <TableCell>
                      {store.city && store.state
                        ? `${store.city}/${store.state}`
                        : "-"}
                    </TableCell>
                    <TableCell>{store.category || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={getPriorityColor(store.priority)}>
                        {store.priority || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={store.status === "active" ? "default" : "secondary"}>
                        {store.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setDetailStoreId(store.id);
                            setShowDetailDialog(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            toast.info("Funcionalidade de edição será implementada em breve");
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            if (store.latitude && store.longitude) {
                              window.open(`https://www.google.com/maps?q=${store.latitude},${store.longitude}`, '_blank');
                            } else {
                              toast.error("Localização não disponível para esta loja");
                            }
                          }}
                        >
                          <MapPin className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <NovaLojaDialog
          open={showNovaLoja}
          onOpenChange={setShowNovaLoja}
          onSuccess={fetchStores}
        />
        
        <StoreDetailDialog
          open={showDetailDialog}
          onOpenChange={setShowDetailDialog}
          storeId={detailStoreId}
        />
      </div>
    </DashboardLayout>
  );
};

export default TradeStores;
