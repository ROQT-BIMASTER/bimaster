import { useEffect, useState, useMemo, useRef } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Upload, MapPin, Edit, Eye, Trash2, AlertTriangle, Store as StoreIcon, Sparkles, X, CheckSquare } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Navigate, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { useCnpjEnrichment } from "@/hooks/useCnpjEnrichment";

interface Store {
  id: string;
  code: string;
  name: string;
  chain: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  priority: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  classification: string | null;
  vendedor_id: string | null;
  supervisor_id: string | null;
  vendedor_nome?: string;
  supervisor_nome?: string;
  vendedores_count?: number;
  seller_ids?: string[];
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
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | null>(null);
  const [selectedVendedor, setSelectedVendedor] = useState<string | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailStoreId, setDetailStoreId] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editStoreId, setEditStoreId] = useState<string | null>(null);
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);

  // Selection & enrichment
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { enrichStores, isEnriching, progress, cancel } = useCnpjEnrichment();

  // Determinar se o usuário efetivo é admin/supervisor (para controles de UI apenas)
  const effectiveIsAdminOrSupervisor = isImpersonating && impersonatedPermissions 
    ? impersonatedPermissions.isAdmin || impersonatedPermissions.role === 'supervisor'
    : isAdminOrSupervisor;

  // Hook centralizado que respeita hierarquia e impersonação
  const { stores: filteredStores, loading: filteredLoading, refetch: refetchFilteredStores } = useFilteredStores({ activeOnly: false });

  // Ref para comparar IDs e evitar re-fetch desnecessário
  const lastStoreIdsRef = useRef<string>("");
  const [isRefetching, setIsRefetching] = useState(false);

  // Buscar detalhes completos das lojas filtradas pelo hook
  useEffect(() => {
    if (filteredLoading || permissionsLoading || roleLoading) return;
    if (!hasPermission("trade_stores")) return;

    // Comparar IDs para evitar re-fetch se as lojas são as mesmas
    const newIds = filteredStores.map(s => s.id).sort().join(',');
    if (newIds === lastStoreIdsRef.current && allStores.length > 0) {
      setLoading(false);
      return;
    }
    
    const fetchStoreDetails = async () => {
      try {
        if (filteredStores.length === 0) {
          setAllStores([]);
          setStores([]);
          lastStoreIdsRef.current = "";
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
        const storesData = data || [];

        // Resolver nomes de supervisores e vendedores
        const supervisorIds = [...new Set(storesData.map(s => s.supervisor_id).filter(Boolean))] as string[];
        const vendedorIds = [...new Set(storesData.map(s => s.vendedor_id).filter(Boolean))] as string[];

        // Buscar store_sellers primeiro para coletar todos os IDs de vendedores
        const { data: storeSellersRaw } = await supabase
          .from("store_sellers")
          .select("store_id, vendedor_id, is_principal")
          .in("store_id", ids);

        const sellersData = storeSellersRaw || [];
        const sellerVendedorIds = sellersData.map(ss => ss.vendedor_id).filter(Boolean) as string[];
        
        // Coletar todos os profile IDs necessários
        const allProfileIds = [...new Set([...supervisorIds, ...vendedorIds, ...sellerVendedorIds])];

        // Buscar profiles de uma vez
        let profileMap = new Map<string, string>();
        if (allProfileIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles_safe")
            .select("id, nome")
            .in("id", allProfileIds);
          (profilesData || []).forEach((p: any) => {
            if (p.id && p.nome) profileMap.set(p.id, p.nome);
          });
        }

        // Mapa de store_sellers: store_id → { vendedor_nome, count }
        const sellerMap = new Map<string, { nome: string; count: number }>();
        const sellersByStore = new Map<string, typeof sellersData>();
        sellersData.forEach((ss) => {
          const list = sellersByStore.get(ss.store_id) || [];
          list.push(ss);
          sellersByStore.set(ss.store_id, list);
        });
        sellersByStore.forEach((sellers, storeId) => {
          const principal = sellers.find((s) => s.is_principal);
          const vendId = principal?.vendedor_id || sellers[0]?.vendedor_id;
          const nome = vendId ? profileMap.get(vendId) || "" : "";
          sellerMap.set(storeId, { nome, count: sellers.length });
        });

        // Mesclar nomes nos stores
        const enrichedStores: Store[] = storesData.map(s => {
          const sellerInfo = sellerMap.get(s.id);
          const storeSellerIds = (sellersByStore.get(s.id) || []).map(ss => ss.vendedor_id).filter(Boolean) as string[];
          const vendedorNome = sellerInfo?.nome || (s.vendedor_id ? profileMap.get(s.vendedor_id) : undefined) || undefined;
          const vendedoresCount = sellerInfo?.count || (s.vendedor_id ? 1 : 0);
          const supervisorNome = s.supervisor_id ? profileMap.get(s.supervisor_id) : undefined;
          return {
            ...s,
            vendedor_nome: vendedorNome,
            supervisor_nome: supervisorNome,
            vendedores_count: vendedoresCount,
            seller_ids: storeSellerIds,
          };
        });

        lastStoreIdsRef.current = newIds;
        setAllStores(enrichedStores);
        setStores(enrichedStores);
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
    setIsRefetching(true);
    // Limpar ref para forçar re-fetch com novos dados
    lastStoreIdsRef.current = "";
    await refetchFilteredStores();
    setIsRefetching(false);
  };

  const applyFilters = () => {
    let filtered = [...allStores];

    if (selectedStore) {
      filtered = filtered.filter(s => s.id === selectedStore);
    }

    if (selectedSupervisor) {
      filtered = filtered.filter(s => s.supervisor_id === selectedSupervisor);
    }

    if (selectedVendedor) {
      filtered = filtered.filter(s => 
        s.vendedor_id === selectedVendedor || 
        (s.seller_ids && s.seller_ids.includes(selectedVendedor))
      );
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
  }, [selectedStore, selectedSupervisor, selectedVendedor, aiCriteria, allStores]);

  // Clear selection when exiting selection mode
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedIds(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  // Handle enrichment
  const handleEnrichSelected = async () => {
    const selected = stores.filter(s => selectedIds.has(s.id));
    const storesToEnrich = selected.map(s => ({
      id: s.id,
      name: s.name,
      cnpj: s.cnpj,
    }));

    const results = await enrichStores(storesToEnrich);
    if (results) {
      setSelectionMode(false);
      setSelectedIds(new Set());
      // enrichStores already invalidates the 'filtered-stores' query cache,
      // so we just need to wait for data to propagate and refetch store details
      // without setting loading=true (which could get stuck)
      try {
        await refetchFilteredStores();
      } catch {
        // silent - cache invalidation from hook already handled it
      }
    }
  };

  const selectedCount = selectedIds.size;
  const selectedWithCnpj = useMemo(() => {
    return stores.filter(s => selectedIds.has(s.id) && s.cnpj && s.cnpj.replace(/\D/g, "").length === 14).length;
  }, [selectedIds, stores]);

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
      key: "vendedor_nome", 
      label: "Vendedor", 
      hideOnMobile: true,
      render: (store: Store) => {
        if (!store.vendedor_nome) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="text-sm">
            {store.vendedor_nome}
            {(store.vendedores_count || 0) > 1 && (
              <span className="text-muted-foreground ml-1">+{(store.vendedores_count || 1) - 1}</span>
            )}
          </span>
        );
      }
    },
    { 
      key: "supervisor_nome", 
      label: "Supervisor", 
      hideOnMobile: true,
      render: (store: Store) => store.supervisor_nome || <span className="text-muted-foreground">-</span>
    },
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
              {(store.vendedor_nome || store.supervisor_nome) && (
                <p className="text-xs text-muted-foreground truncate">
                  {store.vendedor_nome && `Vend: ${store.vendedor_nome}`}
                  {store.vendedor_nome && store.supervisor_nome && " • "}
                  {store.supervisor_nome && `Sup: ${store.supervisor_nome}`}
                </p>
              )}
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
          {!selectionMode && (
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
          )}
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

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
        <div data-tour="stores-header">
          <TradePageHeader
            title="Pontos de Venda"
            description={`${stores.length} PDVs cadastrados`}
            actions={
              <div data-tour="stores-actions" className="flex gap-2 flex-wrap">
                {/* Selection Mode Toggle */}
                <Button
                  variant={selectionMode ? "secondary" : "outline"}
                  size="sm"
                  className="h-9 text-xs sm:text-sm"
                  onClick={toggleSelectionMode}
                  disabled={isEnriching}
                >
                  {selectionMode ? (
                    <>
                      <X className="mr-1.5 h-4 w-4" />
                      <span className="hidden sm:inline">Cancelar</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="mr-1.5 h-4 w-4" />
                      <span className="hidden sm:inline">Selecionar</span>
                    </>
                  )}
                </Button>

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

        {/* Selection Action Bar */}
        {selectionMode && selectedCount > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm">
                <span className="font-medium">{selectedCount}</span> loja(s) selecionada(s)
                {selectedWithCnpj < selectedCount && (
                  <span className="text-muted-foreground ml-1">
                    ({selectedWithCnpj} com CNPJ válido)
                  </span>
                )}
              </div>
              <Button
                size="sm"
                className="h-8 text-xs bg-trade hover:bg-trade-dark"
                onClick={handleEnrichSelected}
                disabled={isEnriching || selectedWithCnpj === 0}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Enriquecer Dados ({selectedWithCnpj})
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Enrichment Progress Bar */}
        {isEnriching && (
          <Card className="border-trade/30">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-trade">
                  Enriquecendo: {progress.current}/{progress.total}
                </span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="text-green-600">✓ {progress.succeeded}</span>
                  {progress.failed > 0 && <span className="text-destructive">✗ {progress.failed}</span>}
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={cancel}>
                    Cancelar
                  </Button>
                </div>
              </div>
              <Progress value={progressPercent} className="h-2" />
              {progress.currentStore && (
                <p className="text-xs text-muted-foreground truncate">
                  Processando: {progress.currentStore}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div data-tour="stores-filters">
          <TradeFilters
            selectedStore={selectedStore}
            onStoreChange={setSelectedStore}
            onAIFilter={setAiCriteria}
            selectedSupervisor={selectedSupervisor}
            onSupervisorChange={setSelectedSupervisor}
            selectedVendedor={selectedVendedor}
            onVendedorChange={setSelectedVendedor}
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
            onRowClick={selectionMode ? undefined : (store) => {
              setDetailStoreId(store.id);
              setShowDetailDialog(true);
            }}
            actions={selectionMode ? undefined : renderActions}
            selectable={selectionMode}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
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
