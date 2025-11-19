import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package, DollarSign, AlertTriangle, Activity, Loader2 } from "lucide-react";
import { Navigate, Link } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { Button } from "@/components/ui/button";

const FabricaModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [stats, setStats] = useState({
    totalMPs: 0,
    totalEstoque: 0,
    mpsEmFalta: 0,
    ordensAtivas: 0,
  });
  const [loading, setLoading] = useState(true);

  if (!permissionsLoading && !hasPermission("fabrica_dashboard")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Total de matérias-primas
      const { count: mpsCount } = await supabase
        .from("fabrica_materias_primas")
        .select("*", { count: "exact", head: true });

      // Matérias-primas em falta (estoque abaixo do mínimo)
      const { data: mpsData } = await supabase
        .from("fabrica_materias_primas")
        .select("estoque_atual, estoque_minimo");

      const emFaltaCount = mpsData?.filter(mp => mp.estoque_atual < mp.estoque_minimo).length || 0;

      // Ordens de produção ativas
      const { count: ordensCount } = await supabase
        .from("fabrica_ordens_producao")
        .select("*", { count: "exact", head: true })
        .in("status", ["pendente", "em_producao"]);

      // Valor total em estoque (soma custo_unitario * estoque_atual)
      const { data: estoqueData } = await supabase
        .from("fabrica_materias_primas")
        .select("estoque_atual, custo_unitario");

      const totalEstoque = estoqueData?.reduce(
        (acc, mp) => acc + (mp.estoque_atual || 0) * (mp.custo_unitario || 0),
        0
      ) || 0;

      setStats({
        totalMPs: mpsCount || 0,
        totalEstoque: totalEstoque,
        mpsEmFalta: emFaltaCount || 0,
        ordensAtivas: ordensCount || 0,
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Fábrica</h1>
          <p className="text-muted-foreground">Gestão de Custos e Produção</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Matérias-Primas</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMPs}</div>
              <p className="text-xs text-muted-foreground">Itens cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor em Estoque</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {stats.totalEstoque.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Valor total investido</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MPs em Falta</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.mpsEmFalta}</div>
              <p className="text-xs text-muted-foreground">Abaixo do estoque mínimo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ordens Ativas</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.ordensAtivas}</div>
              <p className="text-xs text-muted-foreground">Em produção ou pendentes</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Acesso Rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/dashboard/fabrica/materias-primas">
                <Button variant="outline" className="w-full justify-start">
                  <Package className="w-4 h-4 mr-2" />
                  Matérias-Primas
                </Button>
              </Link>
              <Link to="/dashboard/fabrica/produtos">
                <Button variant="outline" className="w-full justify-start">
                  <Package className="w-4 h-4 mr-2" />
                  Produtos
                </Button>
              </Link>
              <Link to="/dashboard/fabrica/producao">
                <Button variant="outline" className="w-full justify-start">
                  <Activity className="w-4 h-4 mr-2" />
                  Ordens de Produção
                </Button>
              </Link>
              <Link to="/dashboard/fabrica/custos">
                <Button variant="outline" className="w-full justify-start">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Custos
                </Button>
              </Link>
            </CardContent>
          </Card>

          {stats.mpsEmFalta > 0 && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Alertas Críticos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-4">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-1" />
                  <div>
                    <p className="font-medium">Matérias-primas em falta</p>
                    <p className="text-sm text-muted-foreground">
                      {stats.mpsEmFalta} {stats.mpsEmFalta === 1 ? "item está" : "itens estão"} com
                      estoque abaixo do mínimo. Verifique e solicite reposição.
                    </p>
                    <Link to="/dashboard/fabrica/materias-primas">
                      <Button variant="link" className="px-0 mt-2">
                        Ver itens em falta
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FabricaModule;
