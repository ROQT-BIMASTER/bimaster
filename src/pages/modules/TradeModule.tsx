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

const TradeModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const { isAdmin, isAdminOrSupervisor } = useUserRole();
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  
  // Usar hook centralizado para contagem de lojas filtradas
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
        totalStores: filteredStores.length, // Usar contagem do hook filtrado
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

  // Módulos secundários agrupados
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
      <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
        {/* Header - Compacto no mobile */}
        <div className="px-1" data-tour="trade-header">
          <h1 className="text-2xl sm:text-3xl font-bold">Trade Marketing</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
            Gestão de PDVs, visitas e execução
          </p>
        </div>

        {/* Quick Entry Dialog */}
        <QuickEntryDialog 
          open={quickEntryOpen} 
          onOpenChange={setQuickEntryOpen}
        />

        {/* Ações Rápidas - Layout vertical no mobile */}
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3" data-tour="quick-actions">
          <Button 
            onClick={() => setQuickEntryOpen(true)} 
            size="lg"
            className="h-12 sm:h-14 gap-2 sm:gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg text-sm sm:text-base"
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
            className="h-12 sm:h-14 gap-2 sm:gap-3 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-400 text-sm sm:text-base"
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
            className="h-12 sm:h-14 gap-2 sm:gap-3 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-400 text-sm sm:text-base"
          >
            <Link to="/dashboard/trade/photos">
              <div className="p-1 sm:p-1.5 bg-purple-200 dark:bg-purple-800 rounded-lg">
                <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="font-semibold">Capturar Foto</span>
            </Link>
          </Button>
        </div>

        {/* Módulos Principais - Grid 2x2 no mobile */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4" data-tour="main-modules">
          {/* PDVs */}
          <Link to="/dashboard/trade/stores">
            <Card className="group relative overflow-hidden hover:shadow-lg active:scale-[0.98] transition-all duration-200 border-l-4 border-l-blue-500 h-full touch-manipulation">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2 sm:p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg sm:rounded-xl">
                    <Store className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                </div>
                <div className="mt-2 sm:mt-4">
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {stats?.totalStores || 0}
                  </p>
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5 sm:mt-1">PDVs Ativos</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Pontos de venda</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Visitas */}
          <Link to="/dashboard/trade/visits">
            <Card className="group relative overflow-hidden hover:shadow-lg active:scale-[0.98] transition-all duration-200 border-l-4 border-l-green-500 h-full touch-manipulation">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2 sm:p-2.5 bg-green-100 dark:bg-green-900/50 rounded-lg sm:rounded-xl">
                    <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                </div>
                <div className="mt-2 sm:mt-4">
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                    {stats?.visitsMonth || 0}
                  </p>
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5 sm:mt-1">Visitas Mês</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Realizadas</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Fotos */}
          <Link to="/dashboard/trade/photos">
            <Card className="group relative overflow-hidden hover:shadow-lg active:scale-[0.98] transition-all duration-200 border-l-4 border-l-purple-500 h-full touch-manipulation">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2 sm:p-2.5 bg-purple-100 dark:bg-purple-900/50 rounded-lg sm:rounded-xl">
                    <Camera className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                </div>
                <div className="mt-2 sm:mt-4">
                  <p className="text-2xl sm:text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {(stats?.totalPhotos || 0).toLocaleString("pt-BR")}
                  </p>
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5 sm:mt-1">Fotos</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Capturadas</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Sell Out */}
          <Link to="/dashboard/trade/sellout">
            <Card className="group relative overflow-hidden hover:shadow-lg active:scale-[0.98] transition-all duration-200 border-l-4 border-l-emerald-500 h-full touch-manipulation">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2 sm:p-2.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg sm:rounded-xl">
                    <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                </div>
                <div className="mt-2 sm:mt-4">
                  <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    R$ {((stats?.totalInvestments || 0) / 1000).toFixed(0)}k
                  </p>
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5 sm:mt-1">Sell Out</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Vendas registradas</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Módulos Secundários - Accordion otimizado para touch */}
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
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted active:bg-muted/70 transition-colors touch-manipulation">
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
                      className="relative flex items-center gap-2 px-3 py-2.5 sm:py-2 rounded-lg bg-background border hover:bg-muted/50 active:bg-muted/70 hover:border-primary/30 transition-colors text-sm touch-manipulation"
                    >
                      {'isNew' in module && module.isNew && (
                        <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[8px] px-1.5 py-0">
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
