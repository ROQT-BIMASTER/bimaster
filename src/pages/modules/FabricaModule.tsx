import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, 
  Layers, 
  Settings, 
  UserCircle, 
  ArrowRight,
  Factory,
  ClipboardList,
  AlertTriangle,
  Calendar,
  Receipt,
  DollarSign,
  FileText,
  Shield,
  Calculator,
  BarChart3,
  CheckCircle,
  Clock,
  Rocket
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";

const FabricaModule = () => {
  const { hasPermission, loading: permissionsLoading } = useScreenPermissions();

  const { data: stats } = useQuery({
    queryKey: ['fabrica-module-stats'],
    queryFn: async () => {
      try {
        const mpsRes = await supabase.from("fabrica_materias_primas").select("id", { count: "exact", head: true });
        const produtosRes = await supabase.from("fabrica_produtos").select("id", { count: "exact", head: true });
        const ordensRes = await supabase.from("fabrica_ordens_producao").select("id", { count: "exact", head: true });
        const maquinasRes = await supabase.from("fabrica_maquinas").select("id", { count: "exact", head: true });

        return {
          totalMPs: mpsRes.count || 0,
          totalProdutos: produtosRes.count || 0,
          ordensAtivas: ordensRes.count || 0,
          totalMaquinas: maquinasRes.count || 0
        };
      } catch {
        return { totalMPs: 0, totalProdutos: 0, ordensAtivas: 0, totalMaquinas: 0 };
      }
    }
  });

  if (!permissionsLoading && !hasPermission("fabrica_dashboard")) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Módulo Fábrica</h1>
          <p className="text-muted-foreground mt-1">
            Gestão completa de produção, matérias-primas, fórmulas e qualidade
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Matérias-Primas</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalMPs || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Produtos Acabados</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.totalProdutos || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">OPs Ativas</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats?.ordensAtivas || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Máquinas</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.totalMaquinas || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Cadastros Básicos */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Cadastros Básicos</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/fabrica/materias-primas">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Matérias-Primas</CardTitle>
                  <Package className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Cadastro e controle de MPs
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/fabrica/produtos-acabados">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Produtos Acabados</CardTitle>
                  <Factory className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Cadastro de produtos finalizados
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/fabrica/maquinas">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Máquinas</CardTitle>
                  <Settings className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Cadastro e manutenção de equipamentos
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/fabrica/operadores">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Operadores</CardTitle>
                  <UserCircle className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Cadastro de operadores de produção
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Fórmulas e Produção */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Fórmulas e Produção</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/fabrica/formulas">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fórmulas BOM</CardTitle>
                  <Layers className="h-4 w-4 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Estrutura de produtos (Bill of Materials)
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/fabrica/ordens-producao">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ordens de Produção</CardTitle>
                  <ClipboardList className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestão de OPs e acompanhamento
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/fabrica/apontamentos">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Apontamentos</CardTitle>
                  <Clock className="h-4 w-4 text-cyan-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Registro de produção e horas
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Apontar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/fabrica/planejamento">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Planejamento MRP</CardTitle>
                  <Calendar className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Planejamento de materiais e recursos
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Planejar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Qualidade e Paradas */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Qualidade e Controle</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/fabrica/qualidade">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Qualidade</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Inspeções e controle de qualidade
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Inspecionar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/fabrica/paradas">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Paradas</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Registro de paradas de produção
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Registrar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/fabrica/recebimentos">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Recebimentos</CardTitle>
                  <Receipt className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Recebimento de notas fiscais
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Receber <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/fabrica/fiscal">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Fiscal NCM</CardTitle>
                  <Shield className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Regras fiscais e NCM
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Configurar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Precificação */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Precificação e Tabelas</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/fabrica/tabelas-preco">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tabelas de Preço</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Gestão de tabelas e preços
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Gerenciar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/fabrica/aprovacao-precos">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aprovação de Preços</CardTitle>
                  <CheckCircle className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Workflow de aprovação de preços
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Aprovar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/fabrica/tabela-impostos">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tabela de Impostos</CardTitle>
                  <Calculator className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Configuração tributária
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Configurar <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/dashboard/relatorios/competitivo">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Relatórios</CardTitle>
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Relatórios e análises de produção
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Ver relatórios <ArrowRight className="h-3 w-3 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Comercial e Lançamentos */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Comercial e Lançamentos</h2>
          <div className="grid gap-4 md:grid-cols-4">
            <Link to="/dashboard/fabrica/lancamentos">
              <Card className="hover:border-primary cursor-pointer transition-colors h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Calendário de Lançamentos</CardTitle>
                  <Rocket className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Planejamento de lançamentos de produtos
                  </p>
                  <div className="mt-2 flex items-center text-xs text-primary">
                    Planejar <ArrowRight className="h-3 w-3 ml-1" />
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

export default FabricaModule;