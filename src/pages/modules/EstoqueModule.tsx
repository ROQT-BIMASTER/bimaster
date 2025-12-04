import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, 
  Package, 
  Link as LinkIcon, 
  Archive, 
  BarChart3, 
  ArrowRight,
  RefreshCw,
  ArrowUpDown,
  Warehouse
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function EstoqueModule() {
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Estoque</h1>
          <p className="text-muted-foreground mt-1">
            Controle centralizado de estoque com integração multidistribuidoras
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Distribuidoras</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.distribuidoras || 0}</div>
              <p className="text-xs text-muted-foreground">Ativas no sistema</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Produtos Master</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.produtos || 0}</div>
              <p className="text-xs text-muted-foreground">Cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Vinculações</CardTitle>
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats?.vinculacoes || 0}</div>
              <p className="text-xs text-muted-foreground">Produtos vinculados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Estoque Total</CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats?.totalEstoque?.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) || 0}
              </div>
              <p className="text-xs text-muted-foreground">Unidades</p>
            </CardContent>
          </Card>
        </div>

        {/* Status de Sincronização */}
        {stats?.ultimaSync && (
          <Card className={stats.ultimaSync.status === 'erro' ? 'border-destructive' : ''}>
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

        {/* Cadastros */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Cadastros</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link to="/dashboard/estoque/distribuidoras">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Distribuidoras</CardTitle>
                  <Building2 className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Cadastro e gestão de distribuidoras
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/estoque/produtos-master">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Produtos Master</CardTitle>
                  <Package className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Cadastro centralizado de produtos
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/estoque/vinculacoes">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Vinculações</CardTitle>
                  <LinkIcon className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Vincular produtos às distribuidoras
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Vincular <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Movimentações e Saldos */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Movimentações e Saldos</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link to="/dashboard/estoque/saldos">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Saldos e Movimentações</CardTitle>
                  <ArrowUpDown className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Controle de estoque e movimentações
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Acessar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/estoque/consolidado">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Visão Consolidada</CardTitle>
                  <BarChart3 className="h-4 w-4 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Estoque total por produto master
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Visualizar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card className="opacity-50 cursor-not-allowed h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inventário</CardTitle>
                <Warehouse className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Contagem e ajustes de inventário
                </p>
                <div className="mt-2 flex items-center text-xs text-muted-foreground">
                  Em breve
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}