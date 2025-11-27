import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Package, DollarSign, AlertTriangle, Activity, Loader2, Calendar, Settings, UserCircle, Clock, Layers, Receipt } from "lucide-react";
import { Navigate, Link } from "react-router-dom";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface MPAlerta {
  id: string;
  nome: string;
  lote: string;
  data_validade: string;
  diasRestantes: number;
}

interface OrdemProducao {
  id: string;
  numero: string;
  produto_nome: string;
  status: string;
  quantidade_planejada: number;
  quantidade_produzida: number;
  progresso: number;
}

const FabricaModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [stats, setStats] = useState({
    totalMPs: 0,
    alertasValidade: 0,
    ordensAtivas: 0,
    custoMedioLote: 0,
  });
  const [alertasValidade, setAlertasValidade] = useState<MPAlerta[]>([]);
  const [ordensRecentes, setOrdensRecentes] = useState<OrdemProducao[]>([]);
  const [loading, setLoading] = useState(true);

  if (!permissionsLoading && !hasPermission("fabrica_dashboard")) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Total de matérias-primas
      const { count: mpsCount } = await supabase
        .from("fabrica_materias_primas")
        .select("*", { count: "exact", head: true });

      // MPs próximas do vencimento (próximos 30 dias)
      const hoje = new Date();
      const em30Dias = new Date();
      em30Dias.setDate(hoje.getDate() + 30);

      const { data: mpsVencimento } = await supabase
        .from("fabrica_materias_primas")
        .select("id, nome, lote, data_validade")
        .not("data_validade", "is", null)
        .lte("data_validade", em30Dias.toISOString().split("T")[0])
        .gte("data_validade", hoje.toISOString().split("T")[0])
        .order("data_validade", { ascending: true })
        .limit(10);

      const alertas: MPAlerta[] = (mpsVencimento || []).map((mp) => {
        const dataValidade = new Date(mp.data_validade);
        const diasRestantes = Math.ceil((dataValidade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: mp.id,
          nome: mp.nome,
          lote: mp.lote || "-",
          data_validade: mp.data_validade,
          diasRestantes,
        };
      });

      setAlertasValidade(alertas);

      // Ordens de produção ativas
      const { data: ordensData, count: ordensCount } = await supabase
        .from("fabrica_ordens_producao")
        .select("id, numero, status, quantidade_planejada, quantidade_produzida, fabrica_produtos(nome)", { count: "exact" })
        .in("status", ["pendente", "em_producao"])
        .order("created_at", { ascending: false })
        .limit(5);

      const ordens: OrdemProducao[] = (ordensData || []).map((ordem) => ({
        id: ordem.id,
        numero: ordem.numero,
        produto_nome: (ordem.fabrica_produtos as any)?.nome || "Produto desconhecido",
        status: ordem.status,
        quantidade_planejada: ordem.quantidade_planejada,
        quantidade_produzida: ordem.quantidade_produzida || 0,
        progresso: Math.round(((ordem.quantidade_produzida || 0) / ordem.quantidade_planejada) * 100),
      }));

      setOrdensRecentes(ordens);

      // Custo médio por lote (média dos custos das últimas OPs)
      const { data: custosData } = await supabase
        .from("fabrica_custos_producao")
        .select("valor, ordem_producao_id")
        .order("created_at", { ascending: false })
        .limit(100);

      const custoPorOrdem = new Map<string, number>();
      (custosData || []).forEach((custo) => {
        const atual = custoPorOrdem.get(custo.ordem_producao_id) || 0;
        custoPorOrdem.set(custo.ordem_producao_id, atual + custo.valor);
      });

      const custos = Array.from(custoPorOrdem.values());
      const custoMedio = custos.length > 0 
        ? custos.reduce((acc, val) => acc + val, 0) / custos.length 
        : 0;

      setStats({
        totalMPs: mpsCount || 0,
        alertasValidade: alertas.length,
        ordensAtivas: ordensCount || 0,
        custoMedioLote: custoMedio,
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "em_producao":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Em Produção</Badge>;
      case "pendente":
        return <Badge variant="secondary">Planejada</Badge>;
      case "finalizada":
        return <Badge className="bg-green-500 hover:bg-green-600">Finalizada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDiasAlert = (dias: number) => {
    if (dias <= 7) {
      return <Badge variant="destructive">{dias} dias</Badge>;
    } else if (dias <= 14) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">{dias} dias</Badge>;
    } else {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">{dias} dias</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard de Produção</h1>
          <p className="text-muted-foreground">Visão geral das operações e indicadores chave</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link to="/dashboard/fabrica/materias-primas">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MPs em Estoque</CardTitle>
                <Package className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalMPs}</div>
                <p className="text-xs text-muted-foreground">Itens cadastrados</p>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas de Validade</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.alertasValidade}</div>
              <p className="text-xs text-muted-foreground">Próximos 30 dias</p>
            </CardContent>
          </Card>

          <Link to="/dashboard/fabrica/ordens-producao">
            <Card className="hover:border-primary transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">OPs Ativas</CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.ordensAtivas}</div>
                <p className="text-xs text-muted-foreground">Em produção</p>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo Médio/Lote</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {stats.custoMedioLote.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Últimas produções</p>
            </CardContent>
          </Card>
        </div>

        {/* Links Rápidos */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Link to="/dashboard/fabrica/formulas">
                <Button variant="outline" className="w-full h-20 flex-col gap-2">
                  <Layers className="h-6 w-6" />
                  <span className="text-sm">Fórmulas BOM</span>
                </Button>
              </Link>
              <Link to="/dashboard/fabrica/tabelas-preco">
                <Button variant="outline" className="w-full h-20 flex-col gap-2">
                  <Receipt className="h-6 w-6" />
                  <span className="text-sm">Tabelas de Preço</span>
                </Button>
              </Link>
              <Link to="/dashboard/fabrica/maquinas">
                <Button variant="outline" className="w-full h-20 flex-col gap-2">
                  <Settings className="h-6 w-6" />
                  <span className="text-sm">Máquinas</span>
                </Button>
              </Link>
              <Link to="/dashboard/fabrica/operadores">
                <Button variant="outline" className="w-full h-20 flex-col gap-2">
                  <UserCircle className="h-6 w-6" />
                  <span className="text-sm">Operadores</span>
                </Button>
              </Link>
              <Link to="/dashboard/fabrica/apontamentos">
                <Button variant="outline" className="w-full h-20 flex-col gap-2">
                  <Clock className="h-6 w-6" />
                  <span className="text-sm">Apontamentos</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <CardTitle>Alertas de Validade</CardTitle>
              </div>
              <Badge variant="destructive">{alertasValidade.length} itens</Badge>
            </CardHeader>
            <CardContent>
              {alertasValidade.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum alerta de validade</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertasValidade.map((mp) => (
                    <div key={mp.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{mp.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Lote: {mp.lote} • {new Date(mp.data_validade).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      {getDiasAlert(mp.diasRestantes)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                <CardTitle>Ordens de Produção Recentes</CardTitle>
              </div>
              <Badge className="bg-blue-500">{ordensRecentes.length} ativas</Badge>
            </CardHeader>
            <CardContent>
              {ordensRecentes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma ordem ativa</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ordensRecentes.map((ordem) => (
                    <div key={ordem.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{ordem.numero}</p>
                          <p className="text-xs text-muted-foreground">{ordem.produto_nome}</p>
                        </div>
                        {getStatusBadge(ordem.status)}
                      </div>
                      <Progress value={ordem.progresso} className="h-2" />
                      <p className="text-xs text-muted-foreground text-right">
                        {ordem.quantidade_produzida} / {ordem.quantidade_planejada} unidades ({ordem.progresso}%)
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FabricaModule;
