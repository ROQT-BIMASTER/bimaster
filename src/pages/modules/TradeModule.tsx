import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Store, 
  Calendar, 
  Camera, 
  TrendingUp, 
  Target, 
  ArrowRight,
  BarChart3,
  Trophy,
  DollarSign,
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
  Zap
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { startOfMonth } from "date-fns";
import { QuickEntryDialog } from "@/components/trade/QuickEntryDialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const TradeModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const { data: stats } = useQuery({
    queryKey: ['trade-module-stats'],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date());
      
      const [storesRes, visitsRes, photosRes, investmentsRes] = await Promise.all([
        supabase.from("stores").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("visits").select("*", { count: "exact", head: true }).gte("scheduled_date", monthStart.toISOString().split("T")[0]),
        supabase.from("photos").select("*", { count: "exact", head: true }),
        supabase.from("trade_investments").select("amount")
      ]);

      const totalInvestments = investmentsRes.data?.reduce((sum, i) => sum + (parseFloat(i.amount as any) || 0), 0) || 0;

      return {
        totalStores: storesRes.count || 0,
        visitsMonth: visitsRes.count || 0,
        totalPhotos: photosRes.count || 0,
        totalInvestments
      };
    }
  });

  if (!permissionsLoading && !hasPermission("trade_marketing")) {
    return <Navigate to="/dashboard" replace />;
  }

  // Módulos secundários agrupados
  const secondaryModules = {
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
    "Inteligência Competitiva": [
      { title: "Concorrentes", to: "/dashboard/trade/competitors", icon: Target, color: "text-red-600" },
      { title: "Comparação", to: "/dashboard/trade/comparacao-produtos", icon: BarChart3, color: "text-blue-600" },
      { title: "Insights IA", to: "/dashboard/trade/insights", icon: TrendingUp, color: "text-green-600" },
    ],
    "Performance e Vendas": [
      { title: "Promoções", to: "/dashboard/trade/promotions", icon: FileText, color: "text-orange-600" },
      { title: "Performance", to: "/dashboard/trade/performance", icon: TrendingUp, color: "text-blue-600" },
      { title: "Equipe", to: "/dashboard/trade/team-performance", icon: Users, color: "text-purple-600" },
    ],
    "Gamificação": [
      { title: "Ranking", to: "/dashboard/ranking", icon: Trophy, color: "text-amber-500" },
      { title: "Recompensas", to: "/dashboard/trade/rewards", icon: Award, color: "text-green-600" },
    ],
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Trade Marketing</h1>
          <p className="text-muted-foreground mt-1">
            Gestão completa de PDVs, visitas e execução
          </p>
        </div>

        {/* Quick Entry Dialog */}
        <QuickEntryDialog 
          open={quickEntryOpen} 
          onOpenChange={setQuickEntryOpen}
        />

        {/* Ações Rápidas */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Button 
            onClick={() => setQuickEntryOpen(true)} 
            size="lg"
            className="h-14 gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
          >
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Plus className="h-5 w-5" />
            </div>
            <span className="font-semibold">Lançamento Rápido</span>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-14 gap-3 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-400"
          >
            <Link to="/dashboard/trade/visits">
              <div className="p-1.5 bg-green-200 dark:bg-green-800 rounded-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <span className="font-semibold">Nova Visita</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-14 gap-3 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-400"
          >
            <Link to="/dashboard/trade/photos">
              <div className="p-1.5 bg-purple-200 dark:bg-purple-800 rounded-lg">
                <Camera className="h-5 w-5" />
              </div>
              <span className="font-semibold">Capturar Foto</span>
            </Link>
          </Button>
        </div>

        {/* Módulos Principais - 4 cards destacados com métricas */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {/* PDVs */}
          <Link to="/dashboard/trade/stores">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                    <Store className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {stats?.totalStores || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">PDVs Ativos</h3>
                  <p className="text-xs text-muted-foreground">Pontos de venda</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Visitas */}
          <Link to="/dashboard/trade/visits">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-green-100 dark:bg-green-900/50 rounded-xl">
                    <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {stats?.visitsMonth || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Visitas no Mês</h3>
                  <p className="text-xs text-muted-foreground">Realizadas</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Fotos */}
          <Link to="/dashboard/trade/photos">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-purple-100 dark:bg-purple-900/50 rounded-xl">
                    <Camera className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {(stats?.totalPhotos || 0).toLocaleString("pt-BR")}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Fotos</h3>
                  <p className="text-xs text-muted-foreground">Capturadas</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Sell Out */}
          <Link to="/dashboard/trade/sellout">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-emerald-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl">
                    <ShoppingBag className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    R$ {((stats?.totalInvestments || 0) / 1000).toFixed(0)}k
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Sell Out</h3>
                  <p className="text-xs text-muted-foreground">Vendas registradas</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Módulos Secundários - Accordion */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Zap className="h-4 w-4" />
            <span>Mais funcionalidades</span>
          </div>

          {Object.entries(secondaryModules).map(([category, modules]) => (
            <Collapsible
              key={category}
              open={openSections[category]}
              onOpenChange={() => toggleSection(category)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <span className="font-medium text-sm">{category}</span>
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    openSections[category] && "rotate-180"
                  )} 
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-2 pl-2">
                  {modules.map((module) => (
                    <Link 
                      key={module.to} 
                      to={module.to}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-background border hover:bg-muted/50 hover:border-primary/30 transition-colors text-sm"
                    >
                      <module.icon className={cn("h-4 w-4", module.color)} />
                      <span>{module.title}</span>
                    </Link>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
};

export default TradeModule;
