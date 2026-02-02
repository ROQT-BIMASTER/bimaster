import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Layers, 
  Settings, 
  UserCircle, 
  ArrowRight,
  Factory,
  ClipboardList,
  AlertTriangle,
  Calendar,
  Receipt,
  DollarSign,
  FileText,
  Shield,
  Calculator,
  BarChart3,
  CheckCircle,
  Clock,
  Rocket,
  Plus,
  ChevronDown,
  Zap
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { TourButton } from "@/components/tour/TourButton";
import { FABRICA_MODULE_TOUR_ID, fabricaModuleTourSteps } from "@/components/tour/tours/fabricaModuleTour";

const FabricaModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const { data: stats } = useQuery({
    queryKey: ['fabrica-module-stats'],
    queryFn: async () => {
      try {
        const mpsRes = await supabase.from("fabrica_materias_primas").select("id", { count: "exact", head: true });
        const produtosRes = await supabase.from("fabrica_produtos").select("id", { count: "exact", head: true });
        const ordensRes = await supabase.from("fabrica_ordens_producao").select("id", { count: "exact", head: true });
        const maquinasRes = await supabase.from("fabrica_maquinas").select("id", { count: "exact", head: true });

        return {
          totalMPs: mpsRes.count || 0,
          totalProdutos: produtosRes.count || 0,
          ordensAtivas: ordensRes.count || 0,
          totalMaquinas: maquinasRes.count || 0
        };
      } catch {
        return { totalMPs: 0, totalProdutos: 0, ordensAtivas: 0, totalMaquinas: 0 };
      }
    }
  });

  if (!permissionsLoading && !hasPermission("fabrica_dashboard")) {
    return <Navigate to="/dashboard" replace />;
  }

  // Módulos secundários agrupados
  const secondaryModules = {
    "Cadastros Básicos": [
      { title: "Máquinas", to: "/dashboard/fabrica/maquinas", icon: Settings, color: "text-gray-600" },
      { title: "Operadores", to: "/dashboard/fabrica/operadores", icon: UserCircle, color: "text-purple-600" },
    ],
    "Produção e Planejamento": [
      { title: "Apontamentos", to: "/dashboard/fabrica/apontamentos", icon: Clock, color: "text-cyan-600" },
      { title: "Planejamento MRP", to: "/dashboard/fabrica/planejamento", icon: Calendar, color: "text-orange-600" },
      { title: "Paradas", to: "/dashboard/fabrica/paradas", icon: AlertTriangle, color: "text-red-600" },
    ],
    "Qualidade e Recebimento": [
      { title: "Qualidade", to: "/dashboard/fabrica/qualidade", icon: CheckCircle, color: "text-green-600" },
      { title: "Recebimentos", to: "/dashboard/fabrica/recebimentos", icon: Receipt, color: "text-blue-600" },
      { title: "Fiscal NCM", to: "/dashboard/fabrica/fiscal", icon: Shield, color: "text-gray-600" },
    ],
    "Precificação": [
      { title: "Tabelas de Preço", to: "/dashboard/fabrica/tabelas-preco", icon: DollarSign, color: "text-green-600" },
      { title: "Aprovação de Preços", to: "/dashboard/fabrica/aprovacao-precos", icon: CheckCircle, color: "text-orange-600" },
      { title: "Tabela de Impostos", to: "/dashboard/fabrica/tabela-impostos", icon: Calculator, color: "text-red-600" },
      { title: "Relatórios", to: "/dashboard/relatorios/competitivo", icon: BarChart3, color: "text-purple-600" },
    ],
    "Comercial": [
      { title: "Calendário de Lançamentos", to: "/dashboard/fabrica/lancamentos", icon: Rocket, color: "text-primary" },
    ],
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="fabrica-header">
          <h1 className="text-3xl font-bold">Módulo Fábrica</h1>
          <p className="text-muted-foreground mt-1">
            Gestão de produção, matérias-primas e qualidade
          </p>
        </div>

        {/* Ações Rápidas */}
        <div data-tour="fabrica-quick-actions" className="grid gap-3 grid-cols-1 sm:grid-cols-4">
          <Button 
            asChild
            size="lg"
            className="h-14 gap-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-lg"
          >
            <Link to="/dashboard/fabrica/executivo">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <BarChart3 className="h-5 w-5" />
              </div>
              <span className="font-semibold">Visão Executiva</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            className="h-14 gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
          >
            <Link to="/dashboard/fabrica/ordens-producao">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Plus className="h-5 w-5" />
              </div>
              <span className="font-semibold">Nova OP</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-14 gap-3 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-400"
          >
            <Link to="/dashboard/fabrica/materias-primas">
              <div className="p-1.5 bg-amber-200 dark:bg-amber-800 rounded-lg">
                <Package className="h-5 w-5" />
              </div>
              <span className="font-semibold">Matérias-Primas</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-14 gap-3 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-400"
          >
            <Link to="/dashboard/fabrica/formulas">
              <div className="p-1.5 bg-indigo-200 dark:bg-indigo-800 rounded-lg">
                <Layers className="h-5 w-5" />
              </div>
              <span className="font-semibold">Fórmulas BOM</span>
            </Link>
          </Button>
        </div>

        {/* Módulos Principais - 4 cards destacados com métricas */}
        <div data-tour="fabrica-main-modules" className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Matérias-Primas */}
          <Link to="/dashboard/fabrica/materias-primas">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-amber-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                    <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {stats?.totalMPs || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Matérias-Primas</h3>
                  <p className="text-xs text-muted-foreground">Cadastradas</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Produtos Acabados */}
          <Link to="/dashboard/fabrica/produtos-acabados">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                    <Factory className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {stats?.totalProdutos || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Produtos Acabados</h3>
                  <p className="text-xs text-muted-foreground">Finalizados</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Ordens de Produção */}
          <Link to="/dashboard/fabrica/ordens-producao">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-orange-100 dark:bg-orange-900/50 rounded-xl">
                    <ClipboardList className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {stats?.ordensAtivas || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">OPs Ativas</h3>
                  <p className="text-xs text-muted-foreground">Em produção</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Fórmulas */}
          <Link to="/dashboard/fabrica/formulas">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-indigo-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                    <Layers className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                    {stats?.totalMaquinas || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Fórmulas BOM</h3>
                  <p className="text-xs text-muted-foreground">Estruturas</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Módulos Secundários - Accordion */}
        <div data-tour="fabrica-secondary-modules" className="space-y-2">
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
      
      <TourButton 
        tourId={FABRICA_MODULE_TOUR_ID}
        tourSteps={fabricaModuleTourSteps}
        title="Tour do Módulo Fábrica"
        description="Conheça as principais funcionalidades do módulo de produção"
      />
    </DashboardLayout>
  );
};

export default FabricaModule;
