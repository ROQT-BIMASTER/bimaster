import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Plus, CheckCircle, RefreshCw, LayoutDashboard } from "lucide-react";
import { useTradeFinanceiroDashboard } from "@/hooks/useTradeFinanceiroDashboard";
import { TradeVerbaCard } from "@/components/trade/dashboard/TradeVerbaCard";
import { TradeCampanhasAPagarCard } from "@/components/trade/dashboard/TradeCampanhasAPagarCard";
import { TradeFluxoCaixaChart } from "@/components/trade/dashboard/TradeFluxoCaixaChart";
import { TradeLancamentosTable } from "@/components/trade/dashboard/TradeLancamentosTable";
import { useQueryClient } from "@tanstack/react-query";

export default function TradeFinanceiroDashboard() {
  const queryClient = useQueryClient();
  const {
    verbas,
    verbaMetrics,
    campanhaMetrics,
    fluxoCaixa,
    despesasPorCampanha,
    lancamentos,
    isLoading,
    error,
  } = useTradeFinanceiroDashboard();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['trade-dashboard-verbas'] });
    queryClient.invalidateQueries({ queryKey: ['trade-dashboard-campanhas'] });
    queryClient.invalidateQueries({ queryKey: ['trade-dashboard-despesas'] });
    queryClient.invalidateQueries({ queryKey: ['trade-dashboard-lancamentos'] });
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive mb-2">Erro ao carregar dados</p>
            <Button onClick={handleRefresh}>Tentar novamente</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <ModuleBreadcrumb
            moduleName="Financeiro Trade"
            moduleHref="/dashboard/trade/financeiro"
            currentPage="Dashboard Financeiro"
          />
          <div className="flex items-center justify-between mt-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <LayoutDashboard className="h-8 w-8 text-primary" />
                Dashboard Financeiro Trade
              </h1>
              <p className="text-muted-foreground mt-1">
                Visão consolidada de verbas, campanhas e lançamentos
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Link to="/dashboard/trade/financeiro/aprovacoes">
                <Button variant="outline" size="sm">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprovações
                </Button>
              </Link>
              <Link to="/dashboard/trade/financeiro/campanhas">
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Campanha
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Cards de KPIs */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-[350px]" />
            <Skeleton className="h-[350px]" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <TradeVerbaCard 
              metrics={verbaMetrics} 
              verbas={verbas as any[]} 
            />
            <TradeCampanhasAPagarCard 
              metrics={campanhaMetrics} 
              despesasPorCampanha={despesasPorCampanha} 
            />
          </div>
        )}

        {/* Gráfico de Fluxo de Caixa */}
        {isLoading ? (
          <Skeleton className="h-[400px]" />
        ) : (
          <TradeFluxoCaixaChart data={fluxoCaixa} />
        )}

        {/* Tabela de Lançamentos */}
        {isLoading ? (
          <Skeleton className="h-[500px]" />
        ) : (
          <TradeLancamentosTable lancamentos={lancamentos} />
        )}
      </div>
    </DashboardLayout>
  );
}
