import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Store, 
  Calendar, 
  Camera, 
  TrendingUp, 
  Target, 
  ArrowRight,
  BarChart3,
  Trophy,
  DollarSign,
  MapPin,
  ShoppingBag,
  Users,
  FileText,
  Award,
  Image,
  Ruler,
  Building,
  Shield,
  Plus
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { startOfMonth } from "date-fns";
import { QuickEntryDialog } from "@/components/trade/QuickEntryDialog";

const TradeModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['trade-module-stats'],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date());
      
      const [storesRes, visitsRes, photosRes, investmentsRes] = await Promise.all([
        supabase.from("stores").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("visits").select("*", { count: "exact", head: true }).gte("scheduled_date", monthStart.toISOString().split("T")[0]),
        supabase.from("photos").select("*", { count: "exact", head: true }),
        supabase.from("trade_investments").select("amount")
      ]);

      const totalInvestments = investmentsRes.data?.reduce((sum, i) => sum + (parseFloat(i.amount as any) || 0), 0) || 0;

      return {
        totalStores: storesRes.count || 0,
        visitsMonth: visitsRes.count || 0,
        totalPhotos: photosRes.count || 0,
        totalInvestments
      };
    }
  });

  if (!permissionsLoading && !hasPermission("trade_marketing")) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trade Marketing</h1>
            <p className="text-muted-foreground mt-1">
              Gestão completa de PDVs, visitas, execução e inteligência competitiva
            </p>
          </div>
          <Button onClick={() => setQuickEntryOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Lançamento Rápido
          </Button>
        </div>

        {/* Quick Entry Dialog */}
        <QuickEntryDialog 
          open={quickEntryOpen} 
          onOpenChange={setQuickEntryOpen}
        />

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">PDVs Ativos</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalStores || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Visitas no Mês</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.visitsMonth || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fotos Capturadas</CardTitle>
              <Camera className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats?.totalPhotos || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Investimentos</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {(stats?.totalInvestments || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gestão de PDVs e Visitas */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Gestão de PDVs e Visitas</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/trade/stores">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Lojas</CardTitle>
                  <Store className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Cadastro e gestão de pontos de venda
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/store-chains">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Redes</CardTitle>
                  <Building className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestão de redes e bandeiras
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/visits">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Visitas</CardTitle>
                  <Calendar className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Agenda e histórico de visitas
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Acessar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/calendar">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Calendário</CardTitle>
                  <MapPin className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Planejamento de rotas e visitas
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Visualizar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Execução e Auditoria */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Execução e Auditoria</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/trade/photos">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fotos</CardTitle>
                  <Camera className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Galeria e análise de fotos
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Ver fotos <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/auditorias">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Auditorias</CardTitle>
                  <Shield className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Auditorias de gôndola e execução
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Auditar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/shelf-measurements">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Medições</CardTitle>
                  <Ruler className="h-4 w-4 text-cyan-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Medições de share de prateleira
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Medir <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/ideal-photos">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fotos Ideais</CardTitle>
                  <Image className="h-4 w-4 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Padrões de execução visual
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Configurar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Inteligência e Análise */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Inteligência e Análise</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/trade/competitors">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Concorrentes</CardTitle>
                  <Target className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Monitoramento da concorrência
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Analisar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/our-brands">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Nossas Marcas</CardTitle>
                  <Award className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestão de marcas e produtos
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/comparacao-produtos">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Comparação</CardTitle>
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Análise comparativa de produtos
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Comparar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/insights">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Insights IA</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Recomendações por inteligência artificial
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Ver insights <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Sell Out e Performance */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Sell Out e Performance</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/trade/sellout">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sell Out</CardTitle>
                  <ShoppingBag className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Registro de vendas nos PDVs
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Registrar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/promotions">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Promoções</CardTitle>
                  <FileText className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestão de promoções e ofertas
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/performance">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Performance</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Dashboard de desempenho
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Visualizar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/team-performance">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Equipe</CardTitle>
                  <Users className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Performance da equipe de campo
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Ver equipe <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Gamificação */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Gamificação e Recompensas</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Link to="/dashboard/ranking">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ranking</CardTitle>
                  <Trophy className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Ranking de desempenho e pontuação
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Ver ranking <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/trade/rewards">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recompensas</CardTitle>
                  <Award className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Catálogo de prêmios e resgates
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Ver recompensas <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default TradeModule;