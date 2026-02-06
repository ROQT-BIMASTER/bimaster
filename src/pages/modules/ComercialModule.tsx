import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight,
  Calendar,
  Rocket,
  Plus,
  ChevronDown,
  Zap,
  UserX,
  TrendingUp,
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Globe,
  Building2,
  Pickaxe,
  Search,
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

const ComercialModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const { data: stats } = useQuery({
    queryKey: ['comercial-module-stats'],
    queryFn: async () => {
      try {
        // Stats para lançamentos
        const lancamentosRes = await supabase
          .from("lancamentos_produtos")
          .select("status", { count: "exact" });

        const lancamentos = lancamentosRes.data || [];
        const proximosLancamentos = lancamentos.filter(
          (l) => l.status !== "lancado" && l.status !== "cancelado"
        ).length;
        const emPreparacao = lancamentos.filter((l) => l.status === "em_preparacao").length;
        const lancados = lancamentos.filter((l) => l.status === "lancado").length;

        // Produtos pendentes de lançamento
        const { count: produtosPendentes } = await supabase
          .from("fabrica_produtos")
          .select("id", { count: "exact", head: true })
          .in("tipo", ["ACABADO", "INTER"])
          .eq("status_lancamento", "pendente")
          .eq("ativo", true);

        return {
          proximosLancamentos,
          emPreparacao,
          lancados,
          produtosPendentes: produtosPendentes || 0
        };
      } catch {
        return { proximosLancamentos: 0, emPreparacao: 0, lancados: 0, produtosPendentes: 0 };
      }
    }
  });

  // Verificar permissão - comercial_dashboard ou comercial_lancamentos
  if (!permissionsLoading && !hasPermission("comercial_dashboard") && !hasPermission("comercial_lancamentos")) {
    return <Navigate to="/dashboard" replace />;
  }

  // Módulos secundários agrupados
  const secondaryModules = {
    "Gestão de Lançamentos": [
      { title: "Calendário de Lançamentos", to: "/dashboard/comercial/lancamentos", icon: Rocket, color: "text-primary" },
    ],
    "Gestão de Carteira": [
      { title: "Painel de Reativação", to: "/dashboard/comercial/reativacao", icon: UserX, color: "text-destructive" },
    ],
    "Prospecção": [
      { title: "Mineração de Leads", to: "/dashboard/comercial/mineracao", icon: Pickaxe, color: "text-primary" },
    ],
    "Dados de Mercado": [
      { title: "Dados IBGE", to: "/dashboard/comercial/ibge", icon: MapPin, color: "text-primary" },
      { title: "Inteligência Comercial", to: "/dashboard/comercial/inteligencia", icon: Globe, color: "text-primary" },
    ],
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Módulo Comercial</h1>
          <p className="text-muted-foreground mt-1">
            Gestão de lançamentos de produtos e estratégias comerciais
          </p>
        </div>

        {/* Ações Rápidas */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <Button 
            asChild
            size="lg"
            className="h-14 gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
          >
            <Link to="/dashboard/comercial/lancamentos">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <span className="font-semibold">Calendário de Lançamentos</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-14 gap-3 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-400"
          >
            <Link to="/dashboard/comercial/lancamentos?action=novo">
              <div className="p-1.5 bg-green-200 dark:bg-green-800 rounded-lg">
                <Plus className="h-5 w-5" />
              </div>
              <span className="font-semibold">Novo Lançamento</span>
            </Link>
          </Button>
        </div>

        {/* Módulos Principais - 4 cards destacados com métricas */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Próximos Lançamentos */}
          <Link to="/dashboard/comercial/lancamentos">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                    <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {stats?.proximosLancamentos || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Próximos Lançamentos</h3>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span>Agendados</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Em Preparação */}
          <Link to="/dashboard/comercial/lancamentos?status=em_preparacao">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-amber-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                    <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {stats?.emPreparacao || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Em Preparação</h3>
                  <p className="text-xs text-muted-foreground">Aguardando conclusão</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Produtos Pendentes */}
          <Link to="/dashboard/comercial/lancamentos">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-orange-100 dark:bg-orange-900/50 rounded-xl">
                    <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {stats?.produtosPendentes || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Produtos Pendentes</h3>
                  <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Aguardando lançamento</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Lançados */}
          <Link to="/dashboard/comercial/lancamentos?status=lancado">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-green-100 dark:bg-green-900/50 rounded-xl">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {stats?.lancados || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Lançados</h3>
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>Concluídos</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Módulos Secundários - Accordion */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Zap className="h-4 w-4" />
            <span>Funcionalidades</span>
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

export default ComercialModule;
