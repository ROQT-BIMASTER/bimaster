import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, TrendingUp, Activity, Target, ArrowRight, Plus, ChevronDown, Zap, MapPin, Kanban } from "lucide-react";
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
      const stageLabels = ['Novo', 'Contato', 'Proposta', 'Negociação', 'Ganho', 'Perdido'];
      
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
    ],
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Módulo de Prospects</h1>
          <p className="text-muted-foreground mt-1">
            Gestão de prospects e pipeline de vendas
          </p>
        </div>

        {/* Ações Rápidas */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Button 
            asChild
            size="lg"
            className="h-14 gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
          >
            <Link to="/dashboard/prospects/list">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Plus className="h-5 w-5" />
              </div>
              <span className="font-semibold">Novo Prospect</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-14 gap-3 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-400"
          >
            <Link to="/dashboard/prospects/kanban">
              <div className="p-1.5 bg-purple-200 dark:bg-purple-800 rounded-lg">
                <Kanban className="h-5 w-5" />
              </div>
              <span className="font-semibold">Ver Kanban</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-14 gap-3 border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-400"
          >
            <Link to="/dashboard/prospects/atividades">
              <div className="p-1.5 bg-orange-200 dark:bg-orange-800 rounded-lg">
                <Activity className="h-5 w-5" />
              </div>
              <span className="font-semibold">Atividades</span>
            </Link>
          </Button>
        </div>

        {/* Módulos Principais - 4 cards destacados com métricas */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Total Prospects */}
          <Link to="/dashboard/prospects/list">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.totalProspects}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Total Prospects</h3>
                  <p className="text-xs text-muted-foreground">Cadastrados</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Em Negociação */}
          <Link to="/dashboard/prospects/kanban">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-amber-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {stats.prospectsEmNegociacao}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Em Negociação</h3>
                  <p className="text-xs text-muted-foreground">Prospects</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Atividades Hoje */}
          <Link to="/dashboard/prospects/atividades">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-orange-100 dark:bg-orange-900/50 rounded-xl">
                    <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {stats.atividadesHoje}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Atividades Hoje</h3>
                  <p className="text-xs text-muted-foreground">Registradas</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Taxa de Conversão */}
          <Link to="/dashboard/prospects/list">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-green-100 dark:bg-green-900/50 rounded-xl">
                    <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {stats.taxaConversao}%
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Conversão</h3>
                  <p className="text-xs text-muted-foreground">Taxa</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Pipeline Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Pipeline de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pipelineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Módulos Secundários - Accordion */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Zap className="h-4 w-4" />
            <span>Mais visualizações</span>
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

export default ProspectsModule;
