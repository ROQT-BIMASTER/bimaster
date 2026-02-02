import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, Clock, CheckCircle, AlertCircle, Loader2, DollarSign, Users, Eye } from "lucide-react";
import { Navigate, Link } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";

interface TabelaStats {
  totalTabelas: number;
  tabelasAtivas: number;
  aguardandoAprovacao: number;
  aprovadas: number;
  rejeitadas: number;
}

const TabelasPrecosModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const queryClient = useQueryClient();
  const [stats, setStats] = useState<TabelaStats>({
    totalTabelas: 0,
    tabelasAtivas: 0,
    aguardandoAprovacao: 0,
    aprovadas: 0,
    rejeitadas: 0,
  });
  const [loading, setLoading] = useState(true);

  // Verificar se tem pelo menos uma tela do módulo de preços
  const hasAnyPrecosPermission = hasPermission("precos_dashboard") || 
    hasPermission("precos_matriz") || 
    hasPermission("precos_tabelas") || 
    hasPermission("fabrica_tabelas_preco") ||
    hasPermission("precos_aprovacao") || 
    hasPermission("precos_portal") || 
    hasPermission("precos_acesso");

  if (!permissionsLoading && !hasAnyPrecosPermission) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchDashboardData();
    
    // Realtime: escutar mudanças nas tabelas
    const channel = supabase
      .channel('tabelas-preco-module-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fabrica_tabelas_preco',
        },
        () => {
          fetchDashboardData();
          queryClient.invalidateQueries({ queryKey: ["fabrica-tabelas-preco"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const fetchDashboardData = async () => {
    try {
      // Total de tabelas
      const { data: tabelas, error } = await supabase
        .from("fabrica_tabelas_preco")
        .select("*");

      if (error) throw error;

      const totalTabelas = tabelas?.length || 0;
      const tabelasAtivas = tabelas?.filter(t => t.ativo).length || 0;
      const aguardandoAprovacao = tabelas?.filter(t => t.status === 'pending_approval').length || 0;
      const aprovadas = tabelas?.filter(t => t.status === 'approved').length || 0;
      const rejeitadas = tabelas?.filter(t => t.status === 'rejected').length || 0;

      setStats({
        totalTabelas,
        tabelasAtivas,
        aguardandoAprovacao,
        aprovadas,
        rejeitadas,
      });
    } catch (error) {
      console.error("Erro ao buscar dados do dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || permissionsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Módulo de Tabelas de Preços</h1>
          <p className="text-muted-foreground">Gerencie, aprove e visualize tabelas de preços</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Tabelas</CardTitle>
              <Receipt className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTabelas}</div>
              <p className="text-xs text-muted-foreground">Cadastradas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tabelas Ativas</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tabelasAtivas}</div>
              <p className="text-xs text-muted-foreground">Em uso</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aguardando Aprovação</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.aguardandoAprovacao}</div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.aprovadas}</div>
              <p className="text-xs text-muted-foreground">Aprovadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejeitadas}</div>
              <p className="text-xs text-muted-foreground">Reprovadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Links Rápidos */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link to="/dashboard/precos/tabelas">
                <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <Receipt className="h-8 w-8" />
                  <span className="text-sm font-medium">Tabelas de Preços</span>
                  <span className="text-xs text-muted-foreground">Gerenciar tabelas</span>
                </Button>
              </Link>
              <Link to="/dashboard/precos/aprovacao">
                <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <CheckCircle className="h-8 w-8" />
                  <span className="text-sm font-medium">Aprovação</span>
                  <span className="text-xs text-muted-foreground">Aprovar tabelas pendentes</span>
                  {stats.aguardandoAprovacao > 0 && (
                    <Badge className="bg-yellow-500 hover:bg-yellow-600">
                      {stats.aguardandoAprovacao}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link to="/dashboard/precos/portal-cliente">
                <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <Eye className="h-8 w-8" />
                  <span className="text-sm font-medium">Portal Cliente</span>
                  <span className="text-xs text-muted-foreground">Visualizar como cliente</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Informações Adicionais */}
        <Card>
          <CardHeader>
            <CardTitle>Sobre o Módulo de Tabelas de Preços</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Gerenciamento de Tabelas
                </h3>
                <p className="text-sm text-muted-foreground">
                  Crie e gerencie tabelas de preços com markups personalizados, 
                  encadeamento de tabelas e geração automática de preços baseada em custos.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Fluxo de Aprovação
                </h3>
                <p className="text-sm text-muted-foreground">
                  Sistema de aprovação com histórico de versões, permitindo controle 
                  e rastreabilidade de todas as alterações nas tabelas de preços.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Portal do Cliente
                </h3>
                <p className="text-sm text-muted-foreground">
                  Seus clientes podem visualizar e exportar tabelas de preços vinculadas 
                  ao CNPJ deles, com total transparência e facilidade.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-yellow-500" />
                  Precificação Inteligente
                </h3>
                <p className="text-sm text-muted-foreground">
                  Calcule preços automaticamente com base em custos de produção, 
                  impostos, markups e outras tabelas, mantendo consistência em toda a cadeia.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TabelasPrecosModule;
