import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  Package, 
  Link as LinkIcon, 
  Archive, 
  BarChart3, 
  ArrowRight,
  RefreshCw,
  ArrowUpDown,
  Warehouse,
  ChevronDown,
  Zap,
  Plus
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export default function EstoqueModule() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const { data: stats } = useQuery({
    queryKey: ['estoque-module-stats'],
    queryFn: async () => {
      const [distribuidoras, produtos, vinculacoes, saldos, syncLogs] = await Promise.all([
        supabase.from('estoque_distribuidoras').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('estoque_produtos_master').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('estoque_produtos_distribuidora').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('estoque_saldos').select('quantidade_disponivel'),
        supabase.from('estoque_sync_logs').select('*').order('created_at', { ascending: false }).limit(1)
      ]);

      const totalEstoque = saldos.data?.reduce((acc, s) => acc + (Number(s.quantidade_disponivel) || 0), 0) || 0;

      return {
        distribuidoras: distribuidoras.count || 0,
        produtos: produtos.count || 0,
        vinculacoes: vinculacoes.count || 0,
        totalEstoque,
        ultimaSync: syncLogs.data?.[0]
      };
    }
  });

  // Módulos secundários agrupados
  const secondaryModules = {
    "Configurações": [
      { title: "Vinculações", to: "/dashboard/estoque/vinculacoes", icon: LinkIcon, color: "text-purple-600" },
      { title: "Inventário", to: "#", icon: Warehouse, color: "text-gray-400", disabled: true },
    ],
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Gestão de Estoque</h1>
          <p className="text-muted-foreground mt-1">
            Controle centralizado com integração multidistribuidoras
          </p>
        </div>

        {/* Ações Rápidas */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Button 
            asChild
            size="lg"
            className="h-14 gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
          >
            <Link to="/dashboard/estoque/produtos-master">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Plus className="h-5 w-5" />
              </div>
              <span className="font-semibold">Novo Produto</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-14 gap-3 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-400"
          >
            <Link to="/dashboard/estoque/distribuidoras">
              <div className="p-1.5 bg-blue-200 dark:bg-blue-800 rounded-lg">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="font-semibold">Distribuidoras</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-14 gap-3 border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-400"
          >
            <Link to="/dashboard/estoque/saldos">
              <div className="p-1.5 bg-orange-200 dark:bg-orange-800 rounded-lg">
                <ArrowUpDown className="h-5 w-5" />
              </div>
              <span className="font-semibold">Movimentações</span>
            </Link>
          </Button>
        </div>

        {/* Módulos Principais - 4 cards destacados com métricas */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Distribuidoras */}
          <Link to="/dashboard/estoque/distribuidoras">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                    <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {stats?.distribuidoras || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Distribuidoras</h3>
                  <p className="text-xs text-muted-foreground">Ativas</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Produtos Master */}
          <Link to="/dashboard/estoque/produtos-master">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-green-100 dark:bg-green-900/50 rounded-xl">
                    <Package className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {stats?.produtos || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Produtos Master</h3>
                  <p className="text-xs text-muted-foreground">Cadastrados</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Visão Consolidada */}
          <Link to="/dashboard/estoque/consolidado">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-indigo-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                    <BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                    {stats?.vinculacoes || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Vinculações</h3>
                  <p className="text-xs text-muted-foreground">Ativas</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Estoque Total */}
          <Link to="/dashboard/estoque/saldos">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-amber-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                    <Archive className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {((stats?.totalEstoque || 0) / 1000).toFixed(1)}k
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Estoque Total</h3>
                  <p className="text-xs text-muted-foreground">Unidades</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Status de Sincronização */}
        {stats?.ultimaSync && (
          <Card className={cn(
            "border-l-4",
            stats.ultimaSync.status === 'erro' ? 'border-l-destructive' : 'border-l-green-500'
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Última Sincronização N8N
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4 flex-wrap">
              <Badge variant={stats.ultimaSync.status === 'sucesso' ? 'default' : stats.ultimaSync.status === 'erro' ? 'destructive' : 'secondary'}>
                {stats.ultimaSync.status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {format(new Date(stats.ultimaSync.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
              <span className="text-sm">
                {stats.ultimaSync.registros_processados} registros processados
              </span>
            </CardContent>
          </Card>
        )}

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
                    module.disabled ? (
                      <span 
                        key={module.title}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-dashed text-muted-foreground text-sm cursor-not-allowed"
                      >
                        <module.icon className="h-4 w-4" />
                        <span>{module.title}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Em breve</span>
                      </span>
                    ) : (
                      <Link 
                        key={module.to} 
                        to={module.to}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-background border hover:bg-muted/50 hover:border-primary/30 transition-colors text-sm"
                      >
                        <module.icon className={cn("h-4 w-4", module.color)} />
                        <span>{module.title}</span>
                      </Link>
                    )
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
}
