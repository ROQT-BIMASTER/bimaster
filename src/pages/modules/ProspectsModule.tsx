import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, TrendingUp, Activity, Target, ArrowRight, Plus, ChevronDown, Zap, MapPin, Kanban, Ticket, List } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const ProspectsModule = () => {
  const [stats, setStats] = useState({
    totalProspects: 0,
    prospectsEmNegociacao: 0,
    atividadesHoje: 0,
    taxaConversao: 0,
  });
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [prospectsResult, negociacaoResult, atividadesResult, ganhosResult] = await Promise.all([
        supabase.from("prospects").select("*", { count: "exact", head: true }),
        supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", "negociacao"),
        supabase
          .from("atividades")
          .select("*", { count: "exact", head: true })
          .gte("data_atividade", new Date().toISOString().split("T")[0]),
        supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", "ganho"),
      ]);

      const total = prospectsResult.count || 0;
      const ganhos = ganhosResult.count || 0;
      const taxaConversao = total > 0 ? Math.round((ganhos / total) * 100) : 0;

      setStats({
        totalProspects: total,
        prospectsEmNegociacao: negociacaoResult.count || 0,
        atividadesHoje: atividadesResult.count || 0,
        taxaConversao,
      });

      // Fetch pipeline data
      const stages = ['novo', 'em_contato', 'proposta_enviada', 'negociacao', 'ganho', 'perdido'] as const;
      const stageLabels = ['Novo', 'Contato', 'Proposta', 'Negoc.', 'Ganho', 'Perdido'];
      
      const pipelineCounts = await Promise.all(
        stages.map(stage =>
          supabase.from("prospects").select("*", { count: "exact", head: true }).eq("status", stage)
        )
      );

      const pipeline = stages.map((stage, index) => ({
        name: stageLabels[index],
        value: pipelineCounts[index].count || 0,
      }));

      setPipelineData(pipeline);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  // Módulos secundários
  const secondaryModules = {
    "Visualizações": [
      { title: "Kanban", to: "/dashboard/prospects/kanban", icon: Kanban, color: "text-purple-600" },
      { title: "Mapa", to: "/dashboard/prospects/mapa", icon: MapPin, color: "text-green-600" },
      { title: "Lista Completa", to: "/dashboard/prospects/list", icon: List, color: "text-blue-600" },
    ],
    "Gestão": [
      { title: "Central de Demandas", to: "/dashboard/demandas", icon: Ticket, color: "text-red-600" },
    ],
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-6">
        {/* Header - Compacto no mobile */}
        <div className="px-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Prospects</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-0.5 sm:mt-1">
            Gestão de prospects e pipeline
          </p>
        </div>

        {/* Ações Rápidas - Layout vertical no mobile */}
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3">
          <Button 
            asChild
            size="lg"
            className="h-12 sm:h-14 gap-2 sm:gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg text-sm sm:text-base"
          >
            <Link to="/dashboard/prospects/list">
              <div className="p-1 sm:p-1.5 bg-white/20 rounded-lg">
                <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="font-semibold">Novo Prospect</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-12 sm:h-14 gap-2 sm:gap-3 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-400 text-sm sm:text-base"
          >
            <Link to="/dashboard/prospects/kanban">
              <div className="p-1 sm:p-1.5 bg-purple-200 dark:bg-purple-800 rounded-lg">
                <Kanban className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="font-semibold">Ver Kanban</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-12 sm:h-14 gap-2 sm:gap-3 border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-400 text-sm sm:text-base"
          >
            <Link to="/dashboard/prospects/atividades">
              <div className="p-1 sm:p-1.5 bg-orange-200 dark:bg-orange-800 rounded-lg">
                <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="font-semibold">Atividades</span>
            </Link>
          </Button>
        </div>

        {/* Módulos Principais - Grid 2x2 no mobile */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Total Prospects */}
          <Link to="/dashboard/prospects/list">
            <Card className="group relative overflow-hidden hover:shadow-lg active:scale-[0.98] transition-all duration-200 border-l-4 border-l-blue-500 h-full touch-manipulation">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2 sm:p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg sm:rounded-xl">
                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                </div>
                <div className="mt-2 sm:mt-4">
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.totalProspects}
                  </p>
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5 sm:mt-1">Total</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Prospects</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Em Negociação */}
          <Link to="/dashboard/prospects/kanban">
            <Card className="group relative overflow-hidden hover:shadow-lg active:scale-[0.98] transition-all duration-200 border-l-4 border-l-amber-500 h-full touch-manipulation">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2 sm:p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg sm:rounded-xl">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                </div>
                <div className="mt-2 sm:mt-4">
                  <p className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {stats.prospectsEmNegociacao}
                  </p>
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5 sm:mt-1">Negociação</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Em andamento</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Atividades Hoje */}
          <Link to="/dashboard/prospects/atividades">
            <Card className="group relative overflow-hidden hover:shadow-lg active:scale-[0.98] transition-all duration-200 border-l-4 border-l-orange-500 h-full touch-manipulation">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2 sm:p-2.5 bg-orange-100 dark:bg-orange-900/50 rounded-lg sm:rounded-xl">
                    <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                </div>
                <div className="mt-2 sm:mt-4">
                  <p className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {stats.atividadesHoje}
                  </p>
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5 sm:mt-1">Atividades</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Hoje</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Taxa de Conversão */}
          <Link to="/dashboard/prospects/list">
            <Card className="group relative overflow-hidden hover:shadow-lg active:scale-[0.98] transition-all duration-200 border-l-4 border-l-green-500 h-full touch-manipulation">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2 sm:p-2.5 bg-green-100 dark:bg-green-900/50 rounded-lg sm:rounded-xl">
                    <Target className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
                </div>
                <div className="mt-2 sm:mt-4">
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                    {stats.taxaConversao}%
                  </p>
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mt-0.5 sm:mt-1">Conversão</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Taxa</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Pipeline Chart - Otimizado para mobile */}
        <Card>
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-base sm:text-lg">Pipeline de Vendas</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6 pb-3 sm:pb-6">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={pipelineData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    fontSize: '12px',
                    padding: '8px'
                  }} 
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Módulos Secundários - Accordion otimizado para touch */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 sm:mb-3 px-1">
            <Zap className="h-4 w-4" />
            <span>Mais visualizações</span>
          </div>

          {Object.entries(secondaryModules).map(([category, modules]) => (
            <Collapsible
              key={category}
              open={openSections[category]}
              onOpenChange={() => toggleSection(category)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted active:bg-muted/70 transition-colors touch-manipulation">
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
                      className="flex items-center gap-2 px-3 py-2.5 sm:py-2 rounded-lg bg-background border hover:bg-muted/50 active:bg-muted/70 hover:border-primary/30 transition-colors text-sm touch-manipulation"
                    >
                      <module.icon className={cn("h-4 w-4 flex-shrink-0", module.color)} />
                      <span className="truncate">{module.title}</span>
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

export default ProspectsModule;
