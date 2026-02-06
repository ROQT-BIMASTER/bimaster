import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MarketKPICards } from "@/components/comercial/MarketKPICards";
import { MarketCoverageTable } from "@/components/comercial/MarketCoverageTable";
import { PenetrationChart } from "@/components/comercial/PenetrationChart";
import { RegionHeatmap } from "@/components/comercial/RegionHeatmap";
import { PortfolioHealthCards } from "@/components/comercial/PortfolioHealthCards";
import { GeographicConcentrationChart } from "@/components/comercial/GeographicConcentrationChart";
import { TicketDistributionChart } from "@/components/comercial/TicketDistributionChart";
import { UntappedPotentialCard } from "@/components/comercial/UntappedPotentialCard";
import { useMarketCoverage } from "@/hooks/useMarketCoverage";
import { useClienteAnalytics } from "@/hooks/useClienteAnalytics";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const MarketIntelligence = () => {
  const { coverageData, kpis, isLoading, refresh, isRefreshing } = useMarketCoverage();
  const { data: analytics, isLoading: loadingAnalytics } = useClienteAnalytics();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <Link to="/dashboard/comercial">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">Inteligência Comercial</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-10">
              Market Share, Penetração e Cobertura de Mercado
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Atualizando..." : "Atualizar Dados"}
          </Button>
        </div>

        {/* KPI Cards */}
        <MarketKPICards kpis={kpis} isLoading={isLoading} />

        {/* Chart + Heatmap */}
        <div className="grid gap-6 lg:grid-cols-2">
          <PenetrationChart data={coverageData} isLoading={isLoading} />
          <RegionHeatmap data={coverageData} isLoading={isLoading} />
        </div>

        {/* Coverage Table */}
        <MarketCoverageTable data={coverageData} isLoading={isLoading} />

        {/* Separator */}
        <div className="flex items-center gap-3 pt-2">
          <Separator className="flex-1" />
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Análise de Carteira de Clientes
          </span>
          <Separator className="flex-1" />
        </div>

        {/* Portfolio Health KPIs */}
        <PortfolioHealthCards kpis={analytics?.portfolioKPIs} isLoading={loadingAnalytics} />

        {/* Geographic Concentration + Ticket Distribution */}
        <div className="grid gap-6 lg:grid-cols-2">
          <GeographicConcentrationChart data={analytics?.concentracaoUF} isLoading={loadingAnalytics} />
          <TicketDistributionChart data={analytics?.faixasTicket} isLoading={loadingAnalytics} />
        </div>

        {/* Untapped Potential */}
        <UntappedPotentialCard data={analytics?.potencialUF} isLoading={loadingAnalytics} />
      </div>
    </DashboardLayout>
  );
};

export default MarketIntelligence;
