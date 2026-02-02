import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ModuleBreadcrumb } from "@/components/navigation/ModuleBreadcrumb";
import { Button } from "@/components/ui/button";
import { RefreshCw, LayoutDashboard, FileSpreadsheet } from "lucide-react";
import { useTradeExecutiveDashboard } from "@/hooks/useTradeExecutiveDashboard";
import { TradeExecutiveKPIs } from "@/components/trade/executive/TradeExecutiveKPIs";
import { TradeExecutiveCampaigns } from "@/components/trade/executive/TradeExecutiveCampaigns";
import { TradeExecutiveEvolutionChart } from "@/components/trade/executive/TradeExecutiveEvolutionChart";
import { TradeExecutiveTopClients } from "@/components/trade/executive/TradeExecutiveTopClients";
import { TradeExecutiveVisitsTable } from "@/components/trade/executive/TradeExecutiveVisitsTable";
import { TradeExecutivePhotosGallery } from "@/components/trade/executive/TradeExecutivePhotosGallery";
import { TradeExecutiveLancamentosTable } from "@/components/trade/executive/TradeExecutiveLancamentosTable";
import { Link } from "react-router-dom";

export default function TradeExecutiveDashboard() {
  const {
    kpis,
    campaigns,
    evolution,
    topClients,
    visits,
    photos,
    lancamentos,
    isLoading,
    isLoadingEvolution,
    isLoadingVisits,
    isLoadingPhotos,
    isLoadingLancamentos,
    error,
    refetchAll,
  } = useTradeExecutiveDashboard();

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-destructive mb-2">Erro ao carregar dados</p>
            <Button onClick={refetchAll}>Tentar novamente</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div>
          <ModuleBreadcrumb
            moduleName="Trade Marketing"
            moduleHref="/dashboard/trade"
            currentPage="Visão Executiva"
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                <LayoutDashboard className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                Visão Executiva Trade Marketing
              </h1>
              <p className="text-muted-foreground mt-1">
                Painel consolidado para acompanhamento da diretoria
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refetchAll}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Link to="/dashboard/trade/financeiro/dashboard">
                <Button variant="outline" size="sm">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Financeiro
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Seção 1: KPIs Principais */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">KPIs Principais</h2>
          <TradeExecutiveKPIs data={kpis} isLoading={isLoading} />
        </section>

        {/* Seção 2: Campanhas */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Campanhas</h2>
          <TradeExecutiveCampaigns data={campaigns} isLoading={isLoading} />
        </section>

        {/* Seção 3: Gráficos */}
        <section className="grid gap-6 lg:grid-cols-2">
          <TradeExecutiveEvolutionChart data={evolution} isLoading={isLoadingEvolution} />
          <TradeExecutiveTopClients data={topClients} isLoading={isLoadingEvolution} />
        </section>

        {/* Seção 4: Tabela de Lançamentos */}
        <section>
          <TradeExecutiveLancamentosTable data={lancamentos as any} isLoading={isLoadingLancamentos} />
        </section>

        {/* Seção 5: Visitas Recentes */}
        <section>
          <TradeExecutiveVisitsTable data={visits} isLoading={isLoadingVisits} />
        </section>

        {/* Seção 6: Galeria de Fotos */}
        <section>
          <TradeExecutivePhotosGallery data={photos} isLoading={isLoadingPhotos} />
        </section>
      </div>
    </DashboardLayout>
  );
}
