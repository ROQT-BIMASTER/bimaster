import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link, Navigate } from "react-router-dom";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Store, 
  Calendar, 
  Camera, 
  Plus,
  ShoppingBag,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { startOfMonth } from "date-fns";
import { QuickEntryDialog } from "@/components/trade/QuickEntryDialog";
import { TourButton, tradeModuleTourSteps, TRADE_MODULE_TOUR_ID } from "@/components/tour";
import { useFilteredStores } from "@/hooks/useFilteredStores";
import { TradeHeroBanner } from "@/components/trade/banners/TradeHeroBanner";
import { IncentivosWeekSection } from "@/components/trade/incentivos/IncentivosWeekSection";
import { TradeSectionHeader } from "@/components/trade/ui/TradeSectionHeader";
import { DisplayHeroBanner } from "@/components/trade/displays/DisplayHeroBanner";
import { LancamentosRecentes } from "@/components/trade/LancamentosRecentes";
import { MateriaisCarousel } from "@/components/trade/MateriaisCarousel";
import { ClipboardList } from "lucide-react";

const TradeModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const { isAdmin: _isAdmin, isAdminOrSupervisor: _isAdminOrSupervisor } = useUserRole();
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  
  
  const { stores: filteredStores, loading: storesLoading } = useFilteredStores();

  const { data: stats } = useQuery({
    queryKey: ['trade-module-stats', filteredStores.length],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date());
      
      const [visitsRes, photosRes, sellOutRes] = await Promise.all([
        supabase.from("visits").select("*", { count: "exact", head: true }).gte("scheduled_date", monthStart.toISOString().split("T")[0]),
        supabase.from("photos").select("*", { count: "exact", head: true }),
        (supabase as any).from("sell_out_entries").select("quantity, unit_price").gte("created_at", monthStart.toISOString())
      ]);

      const sellOutData = (sellOutRes.data || []) as Array<{ quantity: number | null; unit_price: number | null }>;
      const totalSellOut = sellOutData.reduce((sum, e) => sum + ((e.quantity || 0) * (e.unit_price || 0)), 0);

      return {
        totalStores: filteredStores.length,
        visitsMonth: visitsRes.count || 0,
        totalPhotos: photosRes.count || 0,
        totalSellOut
      };
    },
    enabled: !storesLoading,
  });

  if (!permissionsLoading && !hasPermission("trade_marketing")) {
    return <Navigate to="/dashboard" replace />;
  }


  return (
    <DashboardLayout>
      <div className="space-y-5 sm:space-y-6 pb-20 sm:pb-6">
        {/* Header with pink gradient accent */}
        <div className="rounded-2xl bg-gradient-to-r from-[hsl(340,80%,96%)] to-[hsl(280,60%,96%)] dark:from-[hsl(330,40%,12%)] dark:to-[hsl(262,40%,12%)] p-4 sm:p-6" data-tour="trade-header">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] bg-clip-text text-transparent">
            Trade Marketing
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestão de PDVs, visitas e execução
          </p>
        </div>

        {/* Quick Actions - Top of page */}
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3" data-tour="quick-actions">
          <Button 
            onClick={() => setQuickEntryOpen(true)} 
            size="lg"
            className="h-12 sm:h-14 gap-2 sm:gap-3 bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] hover:brightness-110 shadow-lg text-sm sm:text-base text-white"
          >
            <div className="p-1 sm:p-1.5 bg-white/20 rounded-lg">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <span className="font-semibold">Lançamento Rápido</span>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-12 sm:h-14 gap-2 sm:gap-3 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-400 text-sm sm:text-base rounded-xl"
          >
            <Link to="/dashboard/trade/visits">
              <div className="p-1 sm:p-1.5 bg-green-200 dark:bg-green-800 rounded-lg">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="font-semibold">Nova Visita</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-12 sm:h-14 gap-2 sm:gap-3 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-400 text-sm sm:text-base rounded-xl"
          >
            <Link to="/dashboard/trade/photos">
              <div className="p-1 sm:p-1.5 bg-purple-200 dark:bg-purple-800 rounded-lg">
                <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="font-semibold">Capturar Foto</span>
            </Link>
          </Button>
        </div>

        {/* Quick Entry Dialog */}
        <QuickEntryDialog 
          open={quickEntryOpen} 
          onOpenChange={setQuickEntryOpen}
        />

        {/* Lançamentos Recentes */}
        <LancamentosRecentes />

        {/* Banner Carousel */}
        <TradeHeroBanner />

        {/* Display Catalog Carousel */}
        <div className="space-y-2">
          <TradeSectionHeader
            title="Catálogo de Displays"
            subtitle="Conheça nossos displays para PDV"
            linkText="Ver todos"
            linkTo="/dashboard/trade/admin/displays"
          />
          <DisplayHeroBanner />
          <MateriaisCarousel />
        </div>

        {/* KPI Cards - Modernized with rounded corners */}
        <div>
          <TradeSectionHeader title="Visão Geral" subtitle="Dados do mês atual" />
          <div className="grid gap-2 sm:gap-4 grid-cols-2 lg:grid-cols-4 mt-3" data-tour="main-modules">
            <Link to="/dashboard/trade/stores">
              <Card className="group relative overflow-hidden hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl border-0 shadow-soft h-full touch-manipulation bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950 dark:to-blue-900/30">
                <CardContent className="p-3 sm:p-4">
                  <div className="p-1.5 sm:p-2 bg-blue-500/10 rounded-xl w-fit">
                    <Store className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="mt-2">
                    <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {stats?.totalStores || 0}
                    </p>
                    <h3 className="text-[11px] sm:text-xs font-medium mt-0.5">PDVs Ativos</h3>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/visits">
              <Card className="group relative overflow-hidden hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl border-0 shadow-soft h-full touch-manipulation bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950 dark:to-green-900/30">
                <CardContent className="p-3 sm:p-4">
                  <div className="p-1.5 sm:p-2 bg-green-500/10 rounded-xl w-fit">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="mt-2">
                    <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                      {stats?.visitsMonth || 0}
                    </p>
                    <h3 className="text-[11px] sm:text-xs font-medium mt-0.5">Visitas Mês</h3>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/photos">
              <Card className="group relative overflow-hidden hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl border-0 shadow-soft h-full touch-manipulation bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950 dark:to-purple-900/30">
                <CardContent className="p-3 sm:p-4">
                  <div className="p-1.5 sm:p-2 bg-purple-500/10 rounded-xl w-fit">
                    <Camera className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="mt-2">
                    <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {(stats?.totalPhotos || 0).toLocaleString("pt-BR")}
                    </p>
                    <h3 className="text-[11px] sm:text-xs font-medium mt-0.5">Fotos</h3>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/sellout">
              <Card className="group relative overflow-hidden hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl border-0 shadow-soft h-full touch-manipulation bg-gradient-to-br from-[hsl(340,80%,96%)] to-[hsl(330,70%,92%)] dark:from-[hsl(330,40%,12%)] dark:to-[hsl(330,30%,10%)]">
                <CardContent className="p-3 sm:p-4">
                  <div className="p-1.5 sm:p-2 bg-[hsl(330,81%,60%)]/10 rounded-xl w-fit">
                    <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-[hsl(330,81%,60%)]" />
                  </div>
                  <div className="mt-2">
                    <p className="text-lg sm:text-xl font-bold text-[hsl(330,81%,60%)]">
                      R$ {((stats?.totalSellOut || 0) / 1000).toFixed(0)}k
                    </p>
                    <h3 className="text-[11px] sm:text-xs font-medium mt-0.5">Sell Out</h3>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Minhas Solicitações */}
        <Button
          asChild
          variant="outline"
          className="w-full h-12 gap-2 rounded-xl border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-400"
        >
          <Link to="/dashboard/trade/minhas-solicitacoes">
            <ClipboardList className="h-5 w-5" />
            <span className="font-semibold">Minhas Solicitações</span>
          </Link>
        </Button>

        {/* Incentivos da Semana */}
        <IncentivosWeekSection />

        {/* Secondary modules moved to sidebar */}

        {/* Tour Button */}
        <TourButton 
          tourId={TRADE_MODULE_TOUR_ID}
          tourSteps={tradeModuleTourSteps}
          title="Tour do Trade Marketing"
          description="Conheça o módulo de Trade Marketing"
        />
      </div>
    </DashboardLayout>
  );
};

export default TradeModule;
