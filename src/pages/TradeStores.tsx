import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Upload, MapPin, Edit, Eye, Trash2, AlertTriangle, Store as StoreIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Navigate, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { NovaLojaDialog } from "@/components/trade/NovaLojaDialog";
import { EditarLojaDialog } from "@/components/trade/EditarLojaDialog";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { TradeFilters } from "@/components/trade/TradeFilters";
import { StoreDetailDialog } from "@/components/trade/StoreDetailDialog";
import { ClassificationBadge } from "@/components/trade/ClassificationBadge";
import { TradePageHeader } from "@/components/trade/TradePageHeader";
import { MobileDataList } from "@/components/trade/MobileDataList";
import { Card, CardContent } from "@/components/ui/card";
import { TourButton, tradeStoresTourSteps, TRADE_STORES_TOUR_ID } from "@/components/tour";
import { useUserRole } from "@/hooks/useUserRole";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useFilteredStores } from "@/hooks/useFilteredStores";

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
  classification: string | null;
}

const TradeStores = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const { isAdminOrSupervisor, loading: roleLoading } = useUserRole();
  const { isImpersonating, impersonatedUser, impersonatedPermissions } = useImpersonation();
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovaLoja, setShowNovaLoja] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [aiCriteria, setAiCriteria] = useState<any>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailStoreId, setDetailStoreId] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);

  // Determinar se o usuário efetivo é admin/supervisor (para controles de UI apenas)
  const effectiveIsAdminOrSupervisor = isImpersonating && impersonatedPermissions 
    ? impersonatedPermissions.isAdmin || impersonatedPermissions.role === 'supervisor'
    : isAdminOrSupervisor;

  // Hook centralizado que respeita hierarquia e impersonação
  const { stores: filteredStores, loading: filteredLoading, refetch: refetchFilteredStores } = useFilteredStores({ activeOnly: false });

  // Buscar detalhes completos das lojas filtradas pelo hook
  useEffect(() => {
    if (filteredLoading || permissionsLoading || roleLoading) return;
    if (!hasPermission("trade_stores")) return;
    
    const fetchStoreDetails = async () => {
      try {
        if (filteredStores.length === 0) {
          setAllStores([]);
          setStores([]);
          setLoading(false);
          return;
        }

        const ids = filteredStores.map(s => s.id);
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .in("id", ids)
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

    fetchStoreDetails();
  }, [filteredStores, filteredLoading, permissionsLoading, roleLoading]);

  const refetchStores = async () => {
    setLoading(true);
    await refetchFilteredStores();
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

  if (permissionsLoading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-trade" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hasPermission("trade_stores")) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleDeleteStore = async () => {
    if (!deleteStoreId) return;

    try {
      const { error } = await supabase
        .from("stores")
        .update({ status: "inactive" })
        .eq("id", deleteStoreId);

      if (error) throw error;

      toast.success("Loja desativada com sucesso!");
      refetchStores();
      setDeleteStoreId(null);
    } catch (error: any) {
      toast.error("Erro ao desativar loja: " + error.message);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteId) return;

    try {
      const { data: visits } = await supabase
        .from("visits")
        .select("id")
        .eq("store_id", permanentDeleteId)
        .limit(1);

      if (visits && visits.length > 0) {
        toast.error("Não é possível excluir: loja possui visitas registradas.");
        setPermanentDeleteId(null);
        return;
      }

      const { error } = await supabase
        .from("stores")
        .delete()
        .eq("id", permanentDeleteId);

      if (error) throw error;

      toast.success("Loja excluída permanentemente!");
      refetchStores();
      setPermanentDeleteId(null);
    } catch (error: any) {
      toast.error("Erro ao excluir loja: " + error.message);
    }
  };

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Ativo", variant: "default" },
    inactive: { label: "Inativo", variant: "secondary" },
  };

  const columns = [
    { key: "code", label: "Código", hideOnMobile: true },
    { key: "name", label: "Nome" },
    { 
      key: "classification", 
      label: "Class.", 
      render: (store: Store) => (
        <ClassificationBadge classification={store.classification} size="sm" />
      )
    },
    { key: "chain", label: "Rede", hideOnMobile: true, render: (store: Store) => store.chain || "-" },
    { 
      key: "location", 
      label: "Cidade/UF", 
      hideOnMobile: true,
      render: (store: Store) => store.city && store.state ? `${store.city}/${store.state}` : "-"
    },
    { key: "category", label: "Categoria", hideOnMobile: true, render: (store: Store) => store.category || "-" },
    { 
      key: "priority", 
      label: "Prioridade", 
      hideOnMobile: true,
      render: (store: Store) => (
        <Badge variant={store.priority === "alta" ? "destructive" : store.priority === "media" ? "default" : "secondary"}>
          {store.priority || "N/A"}
        </Badge>
      )
    },
    { 
      key: "status", 
      label: "Status",
      render: (store: Store) => (
        <Badge variant={store.status === "active" ? "default" : "secondary"}>
          {statusConfig[store.status]?.label || store.status}
        </Badge>
      )
    },
  ];

  const renderMobileCard = (store: Store) => (
    <Card className="border-l-4 border-l-trade active:scale-[0.99] transition-all touch-manipulation">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 bg-trade-light rounded-lg flex-shrink-0">
              <StoreIcon className="h-4 w-4 text-trade" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{store.name}</p>
                <ClassificationBadge classification={store.classification} size="sm" />
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {store.chain || "Sem rede"} • {store.city || "Sem cidade"}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge 
                  variant={store.status === "active" ? "default" : "secondary"} 
                  className="text-[10px] h-5"
                >
                  {statusConfig[store.status]?.label}
                </Badge>
                {store.priority && (
                  <Badge 
                    variant={store.priority === "alta" ? "destructive" : "outline"}
                    className="text-[10px] h-5"
                  >
                    {store.priority}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                setDetailStoreId(store.id);
                setShowDetailDialog(true);
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderActions = (store: Store) => (
    <>
      <Button 
        variant="ghost" 
        size="icon"
        className="h-8 w-8"
        onClick={() => {
          setDetailStoreId(store.id);
          setShowDetailDialog(true);
        }}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon"
        className="h-8 w-8"
        onClick={() => {
          setEditStoreId(store.id);
          setShowEditDialog(true);
        }}
      >
        <Edit className="h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon"
        className="h-8 w-8"
        onClick={() => setDeleteStoreId(store.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={() => setPermanentDeleteId(store.id)}
      >
        <AlertTriangle className="h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon"
        className="h-8 w-8"
        onClick={() => {
          if (store.latitude && store.longitude) {
            window.open(`https://www.google.com/maps?q=${store.latitude},${store.longitude}`, '_blank');
          } else {
            toast.error("Localização não disponível");
          }
        }}
      >
        <MapPin className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
        <div data-tour="stores-header">
          <TradePageHeader
            title="Pontos de Venda"
            description={`${stores.length} PDVs cadastrados`}
            actions={
              <div data-tour="stores-actions" className="flex gap-2">
                {effectiveIsAdminOrSupervisor && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-9 text-xs sm:text-sm"
                    onClick={() => navigate('/dashboard/trade/import-stores')}
                  >
                    <Upload className="mr-1.5 h-4 w-4" />
                    <span className="hidden sm:inline">Importar</span>
                  </Button>
                )}
                <Button 
                  size="sm"
                  className="h-9 text-xs sm:text-sm bg-trade hover:bg-trade-dark"
                  onClick={() => setShowNovaLoja(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  <span>Nova Loja</span>
                </Button>
              </div>
            }
          />
        </div>

        <div data-tour="stores-filters">
          <TradeFilters
            selectedStore={selectedStore}
            onStoreChange={setSelectedStore}
            onAIFilter={setAiCriteria}
          />
        </div>

        <div data-tour="stores-list">
          <MobileDataList
            data={stores}
            columns={columns}
            loading={loading}
            emptyMessage="Nenhuma loja encontrada"
            keyExtractor={(store) => store.id}
            primaryField="name"
            secondaryField="chain"
            statusField="status"
            statusConfig={statusConfig}
            accentColor="border-l-trade"
            renderMobileCard={renderMobileCard}
            onRowClick={(store) => {
              setDetailStoreId(store.id);
              setShowDetailDialog(true);
            }}
            actions={renderActions}
          />
        </div>

        <NovaLojaDialog
          open={showNovaLoja}
          onOpenChange={setShowNovaLoja}
          onSuccess={refetchStores}
        />
        
        <StoreDetailDialog
          open={showDetailDialog}
          onOpenChange={(open) => {
            setShowDetailDialog(open);
            if (!open) setDetailStoreId(null);
          }}
          storeId={detailStoreId}
        />
        
        <EditarLojaDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          storeId={editStoreId}
          onSuccess={refetchStores}
        />

        <AlertDialog open={!!deleteStoreId} onOpenChange={(open) => !open && setDeleteStoreId(null)}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Desativação</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja desativar esta loja?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteStore} className="bg-destructive text-destructive-foreground">
                Desativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!permanentDeleteId} onOpenChange={(open) => !open && setPermanentDeleteId(null)}>
          <AlertDialogContent className="max-w-[90vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">⚠️ Excluir Permanentemente</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p className="font-semibold">ATENÇÃO: Esta ação não pode ser desfeita!</p>
                <p className="text-sm">Se a loja possui histórico de visitas, não poderá ser excluída.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel className="mt-0">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Tour Button */}
        <TourButton 
          tourId={TRADE_STORES_TOUR_ID}
          tourSteps={tradeStoresTourSteps}
          title="Tour dos PDVs"
          description="Conheça a gestão de pontos de venda"
        />
      </div>
    </DashboardLayout>
  );
};

export default TradeStores;
