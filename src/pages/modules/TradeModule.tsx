import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Store, 
  Calendar, 
  Camera, 
  TrendingUp, 
  Target, 
  ArrowRight,
  BarChart3,
  Trophy,
  MapPin,
  ShoppingBag,
  Users,
  FileText,
  Award,
  Image,
  Ruler,
  Building,
  Shield,
  Plus,
  ChevronDown,
  Zap,
  CheckCircle2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useUserRole } from "@/hooks/useUserRole";
import { startOfMonth } from "date-fns";
import { QuickEntryDialog } from "@/components/trade/QuickEntryDialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { TourButton, tradeModuleTourSteps, TRADE_MODULE_TOUR_ID } from "@/components/tour";
import { useFilteredStores } from "@/hooks/useFilteredStores";
import { TradeHeroBanner } from "@/components/trade/banners/TradeHeroBanner";
import { IncentivosWeekSection } from "@/components/trade/incentivos/IncentivosWeekSection";
import { TradeSearchBar } from "@/components/trade/ui/TradeSearchBar";
import { TradeSectionHeader } from "@/components/trade/ui/TradeSectionHeader";
import { DisplayHeroBanner } from "@/components/trade/displays/DisplayHeroBanner";

const TradeModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const { isAdmin, isAdminOrSupervisor } = useUserRole();
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  
  const { stores: filteredStores, loading: storesLoading } = useFilteredStores();

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const { data: stats } = useQuery({
    queryKey: ['trade-module-stats', filteredStores.length],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date());
      
      const [visitsRes, photosRes, investmentsRes] = await Promise.all([
        supabase.from("visits").select("*", { count: "exact", head: true }).gte("scheduled_date", monthStart.toISOString().split("T")[0]),
        supabase.from("photos").select("*", { count: "exact", head: true }),
        supabase.from("trade_investments").select("amount")
      ]);

      const totalInvestments = investmentsRes.data?.reduce((sum, i) => sum + (parseFloat(i.amount as any) || 0), 0) || 0;

      return {
        totalStores: filteredStores.length,
        visitsMonth: visitsRes.count || 0,
        totalPhotos: photosRes.count || 0,
        totalInvestments
      };
    },
    enabled: !storesLoading,
  });

  if (!permissionsLoading && !hasPermission("trade_marketing")) {
    return <Navigate to="/dashboard" replace />;
  }

  const secondaryModules = {
    ...(hasPermission("trade_admin") ? {
      "Administrativo": [
        { title: "Campanhas & Verbas", to: "/dashboard/trade/admin", icon: Target, color: "text-blue-600", isNew: true },
        { title: "Central de Aprovações", to: "/dashboard/trade/aprovacoes", icon: Shield, color: "text-green-600", isNew: true },
      ],
    } : {}),
    "Cadastros e Configurações": [
      { title: "Redes", to: "/dashboard/trade/store-chains", icon: Building, color: "text-blue-600" },
      { title: "Nossas Marcas", to: "/dashboard/trade/our-brands", icon: Award, color: "text-amber-600" },
      { title: "Fotos Ideais", to: "/dashboard/trade/ideal-photos", icon: Image, color: "text-indigo-600" },
    ],
    "Execução e Auditoria": [
      { title: "Auditorias", to: "/dashboard/trade/auditorias", icon: Shield, color: "text-red-600" },
      { title: "Medições", to: "/dashboard/trade/shelf-measurements", icon: Ruler, color: "text-cyan-600" },
      { title: "Calendário", to: "/dashboard/trade/calendar", icon: MapPin, color: "text-orange-600" },
    ],
    ...(isAdmin ? {
      "Inteligência Competitiva": [
        { title: "Concorrentes", to: "/dashboard/trade/competitors", icon: Target, color: "text-red-600" },
        { title: "Comparação", to: "/dashboard/trade/comparacao-produtos", icon: BarChart3, color: "text-blue-600" },
        { title: "Insights IA", to: "/dashboard/trade/insights", icon: TrendingUp, color: "text-green-600" },
      ],
    } : {}),
    ...(isAdmin ? {
      "Performance e Vendas": [
        { title: "Minha Equipe", to: "/dashboard/trade/minha-equipe", icon: Users, color: "text-indigo-600", isNew: true },
        { title: "Promoções", to: "/dashboard/trade/promotions", icon: FileText, color: "text-orange-600" },
        { title: "Performance", to: "/dashboard/trade/performance", icon: TrendingUp, color: "text-blue-600" },
        { title: "Equipe", to: "/dashboard/trade/team-performance", icon: Users, color: "text-purple-600" },
      ],
      "Gamificação": [
        { title: "Ranking", to: "/dashboard/ranking", icon: Trophy, color: "text-amber-500" },
        { title: "Recompensas", to: "/dashboard/trade/rewards", icon: Award, color: "text-green-600" },
      ],
    } : {}),
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 sm:space-y-6 pb-20 sm:pb-6">
        {/* Header with pink gradient accent */}
        <div className="rounded-2xl bg-gradient-to-r from-[hsl(340,80%,96%)] to-[hsl(280,60%,96%)] dark:from-[hsl(330,40%,12%)] dark:to-[hsl(262,40%,12%)] p-5 sm:p-6" data-tour="trade-header">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] bg-clip-text text-transparent">
            Trade Marketing
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Gestão de PDVs, visitas e execução
          </p>
        </div>

        {/* Search Bar */}
        <TradeSearchBar 
          value={searchQuery} 
          onChange={setSearchQuery} 
          placeholder="Buscar PDVs, visitas, campanhas..." 
        />

        {/* Banner Carousel */}
        <TradeHeroBanner />

        {/* Quick Entry Dialog */}
        <QuickEntryDialog 
          open={quickEntryOpen} 
          onOpenChange={setQuickEntryOpen}
        />

        {/* Quick Actions - Pink themed */}
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

        {/* KPI Cards - Modernized with rounded corners */}
        <div>
          <TradeSectionHeader title="Visão Geral" subtitle="Dados do mês atual" />
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 mt-3" data-tour="main-modules">
            <Link to="/dashboard/trade/stores">
              <Card className="group relative overflow-hidden hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl border-0 shadow-soft h-full touch-manipulation bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950 dark:to-blue-900/30">
                <CardContent className="p-4 sm:p-5">
                  <div className="p-2 sm:p-2.5 bg-blue-500/10 rounded-xl w-fit">
                    <Store className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {stats?.totalStores || 0}
                    </p>
                    <h3 className="text-xs sm:text-sm font-medium mt-0.5">PDVs Ativos</h3>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/visits">
              <Card className="group relative overflow-hidden hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl border-0 shadow-soft h-full touch-manipulation bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950 dark:to-green-900/30">
                <CardContent className="p-4 sm:p-5">
                  <div className="p-2 sm:p-2.5 bg-green-500/10 rounded-xl w-fit">
                    <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                      {stats?.visitsMonth || 0}
                    </p>
                    <h3 className="text-xs sm:text-sm font-medium mt-0.5">Visitas Mês</h3>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/photos">
              <Card className="group relative overflow-hidden hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl border-0 shadow-soft h-full touch-manipulation bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950 dark:to-purple-900/30">
                <CardContent className="p-4 sm:p-5">
                  <div className="p-2 sm:p-2.5 bg-purple-500/10 rounded-xl w-fit">
                    <Camera className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {(stats?.totalPhotos || 0).toLocaleString("pt-BR")}
                    </p>
                    <h3 className="text-xs sm:text-sm font-medium mt-0.5">Fotos</h3>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/sellout">
              <Card className="group relative overflow-hidden hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-2xl border-0 shadow-soft h-full touch-manipulation bg-gradient-to-br from-[hsl(340,80%,96%)] to-[hsl(330,70%,92%)] dark:from-[hsl(330,40%,12%)] dark:to-[hsl(330,30%,10%)]">
                <CardContent className="p-4 sm:p-5">
                  <div className="p-2 sm:p-2.5 bg-[hsl(330,81%,60%)]/10 rounded-xl w-fit">
                    <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-[hsl(330,81%,60%)]" />
                  </div>
                  <div className="mt-3">
                    <p className="text-xl sm:text-2xl font-bold text-[hsl(330,81%,60%)]">
                      R$ {((stats?.totalInvestments || 0) / 1000).toFixed(0)}k
                    </p>
                    <h3 className="text-xs sm:text-sm font-medium mt-0.5">Sell Out</h3>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Incentivos da Semana */}
        <IncentivosWeekSection />

        {/* Secondary Modules */}
        <div className="space-y-2" data-tour="secondary-modules">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 sm:mb-3 px-1">
            <Zap className="h-4 w-4" />
            <span>Mais funcionalidades</span>
          </div>

          {Object.entries(secondaryModules).map(([category, modules]) => (
            <Collapsible
              key={category}
              open={openSections[category]}
              onOpenChange={() => toggleSection(category)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 sm:p-3 rounded-xl bg-muted/50 hover:bg-muted active:bg-muted/70 transition-colors touch-manipulation">
                <span className="font-medium text-sm">{category}</span>
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    openSections[category] && "rotate-180"
                  )} 
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 pl-1 sm:pl-2">
                  {modules.map((module) => (
                    <Link 
                      key={module.to} 
                      to={module.to}
                      className="relative flex items-center gap-2 px-3 py-2.5 sm:py-2 rounded-xl bg-background border hover:bg-muted/50 active:bg-muted/70 hover:border-[hsl(330,81%,60%)]/30 hover:scale-[1.02] transition-all duration-200 text-sm touch-manipulation"
                    >
                      {'isNew' in module && module.isNew && (
                        <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] text-white text-[8px] px-1.5 py-0 border-0">
                          NOVO
                        </Badge>
                      )}
                      <module.icon className={cn("h-4 w-4 flex-shrink-0", module.color)} />
                      <span className="truncate">{module.title}</span>
                    </Link>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

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
