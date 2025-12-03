import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Warehouse, Building2, Package, Link, Archive, BarChart3, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function EstoqueModule() {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['estoque-stats'],
    queryFn: async () => {
      const [distribuidoras, produtos, vinculacoes, saldos, movimentacoes, syncLogs] = await Promise.all([
        supabase.from('estoque_distribuidoras').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('estoque_produtos_master').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('estoque_produtos_distribuidora').select('id', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('estoque_saldos').select('quantidade_disponivel'),
        supabase.from('estoque_movimentacoes').select('id, tipo_movimento', { count: 'exact', head: true }),
        supabase.from('estoque_sync_logs').select('*').order('created_at', { ascending: false }).limit(1)
      ]);

      const totalEstoque = saldos.data?.reduce((acc, s) => acc + (Number(s.quantidade_disponivel) || 0), 0) || 0;

      return {
        distribuidoras: distribuidoras.count || 0,
        produtos: produtos.count || 0,
        vinculacoes: vinculacoes.count || 0,
        totalEstoque,
        movimentacoes: movimentacoes.count || 0,
        ultimaSync: syncLogs.data?.[0]
      };
    }
  });

  const menuItems = [
    {
      title: "Distribuidoras",
      description: "Cadastro e gestão de distribuidoras",
      icon: Building2,
      route: "/dashboard/estoque/distribuidoras",
      count: stats?.distribuidoras
    },
    {
      title: "Produtos Master",
      description: "Cadastro centralizado de produtos",
      icon: Package,
      route: "/dashboard/estoque/produtos-master",
      count: stats?.produtos
    },
    {
      title: "Vinculações",
      description: "Vincular produtos às distribuidoras",
      icon: Link,
      route: "/dashboard/estoque/vinculacoes",
      count: stats?.vinculacoes
    },
    {
      title: "Saldos e Movimentações",
      description: "Controle de estoque e movimentações",
      icon: Archive,
      route: "/dashboard/estoque/saldos",
      count: stats?.movimentacoes
    },
    {
      title: "Visão Consolidada",
      description: "Estoque total por produto master",
      icon: BarChart3,
      route: "/dashboard/estoque/consolidado"
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Warehouse className="h-8 w-8 text-primary" />
              Gestão de Estoque Multidistribuidoras
            </h1>
            <p className="text-muted-foreground mt-1">
              Controle centralizado de estoque com integração N8N
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Distribuidoras</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.distribuidoras}</div>
              )}
              <p className="text-xs text-muted-foreground">Ativas no sistema</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Produtos Master</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.produtos}</div>
              )}
              <p className="text-xs text-muted-foreground">Produtos cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vinculações</CardTitle>
              <Link className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.vinculacoes}</div>
              )}
              <p className="text-xs text-muted-foreground">Produtos vinculados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estoque Total</CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">
                  {stats?.totalEstoque?.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Unidades em estoque</p>
            </CardContent>
          </Card>
        </div>

        {/* Última sincronização */}
        {stats?.ultimaSync && (
          <Card className={stats.ultimaSync.status === 'erro' ? 'border-destructive' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Última Sincronização N8N
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge variant={stats.ultimaSync.status === 'sucesso' ? 'default' : stats.ultimaSync.status === 'erro' ? 'destructive' : 'secondary'}>
                  {stats.ultimaSync.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(stats.ultimaSync.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                <span className="text-sm">
                  {stats.ultimaSync.registros_processados} registros processados
                </span>
                {stats.ultimaSync.registros_erro > 0 && (
                  <span className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {stats.ultimaSync.registros_erro} erros
                  </span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {stats.ultimaSync.duracao_ms}ms
              </span>
            </CardContent>
          </Card>
        )}

        {/* Menu de navegação */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {menuItems.map((item) => (
            <Card 
              key={item.route} 
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => navigate(item.route)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <item.icon className="h-5 w-5 text-primary" />
                  {item.title}
                  {item.count !== undefined && (
                    <Badge variant="secondary" className="ml-auto">
                      {item.count}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Acessar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
