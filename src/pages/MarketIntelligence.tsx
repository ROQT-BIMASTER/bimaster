import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MarketKPICards } from "@/components/comercial/MarketKPICards";
import { MarketCoverageTable } from "@/components/comercial/MarketCoverageTable";
import { PenetrationChart } from "@/components/comercial/PenetrationChart";
import { RegionHeatmap } from "@/components/comercial/RegionHeatmap";
import { PortfolioHealthCards } from "@/components/comercial/PortfolioHealthCards";
import { GeographicConcentrationChart } from "@/components/comercial/GeographicConcentrationChart";
import { TicketDistributionChart } from "@/components/comercial/TicketDistributionChart";
import { UntappedPotentialCard } from "@/components/comercial/UntappedPotentialCard";
import { NormalizationReportCard } from "@/components/comercial/NormalizationReportCard";
import { ComercialFilters } from "@/components/comercial/ComercialFilters";
import { useMarketCoverage } from "@/hooks/useMarketCoverage";
import { useClienteAnalytics } from "@/hooks/useClienteAnalytics";
import { useNormalizacao } from "@/hooks/useNormalizacao";
import { useAllEmpresas } from "@/hooks/useUserEmpresas";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { getUFsByRegiao } from "@/lib/constants/regioes";
import { useMemo } from "react";

const MarketIntelligence = () => {
  const [empresaFilter, setEmpresaFilter] = useState<number | null>(null);
  const [regiaoFilter, setRegiaoFilter] = useState<string | null>(null);
  const ufs = getUFsByRegiao(regiaoFilter);

  const { coverageData: rawCoverageData, kpis: rawKpis, isLoading, refresh, isRefreshing } = useMarketCoverage();
  const { data: analytics, isLoading: loadingAnalytics } = useClienteAnalytics({
    empresaId: empresaFilter,
    ufs,
  });
  const { data: empresasData } = useAllEmpresas();
  const {
    resumo,
    isLoading: loadingNormalizacao,
    executarNormalizacao,
    isNormalizando,
    resultadoNormalizacao,
    recalcularCobertura,
    isRecalculando,
  } = useNormalizacao();

  // Filter market coverage data by region (client-side since snapshot doesn't have empresa_id)
  const coverageData = useMemo(() => {
    if (!regiaoFilter || !ufs) return rawCoverageData;
    return rawCoverageData.filter((r) => ufs.includes(r.uf));
  }, [rawCoverageData, regiaoFilter, ufs]);

  // Recalculate KPIs based on filtered coverage data
  const kpis = useMemo(() => {
    if (!coverageData.length) return rawKpis;
    if (!regiaoFilter) return rawKpis;
    const totalMunicipios = coverageData.reduce((s, r) => s + r.total_municipios, 0);
    const municipiosAtendidos = coverageData.reduce((s, r) => s + r.municipios_com_clientes, 0);
    return {
      totalMunicipios,
      municipiosAtendidos,
      penetracaoNacional: totalMunicipios > 0 ? Number(((municipiosAtendidos / totalMunicipios) * 100).toFixed(2)) : 0,
      totalClientesERP: coverageData.reduce((s, r) => s + r.total_clientes_erp, 0),
      totalProspects: coverageData.reduce((s, r) => s + r.total_prospects, 0),
      totalLeads: coverageData.reduce((s, r) => s + r.total_leads_minerados, 0),
      municipiosProspectados: coverageData.reduce((s, r) => s + r.municipios_com_prospects, 0),
      municipiosMinerados: coverageData.reduce((s, r) => s + r.municipios_com_leads, 0),
      populacaoAtendida: coverageData.filter((r) => r.municipios_com_clientes > 0).reduce((s, r) => s + r.populacao_total, 0),
      populacaoTotal: coverageData.reduce((s, r) => s + r.populacao_total, 0),
      ufsAtendidas: coverageData.filter((r) => r.municipios_com_clientes > 0).length,
      totalUFs: coverageData.length,
    };
  }, [coverageData, rawKpis, regiaoFilter]);

  const empresas = (empresasData || []).map((e) => ({ id: e.id, nome: e.nome }));

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
          <div className="flex items-center gap-2 flex-wrap">
            <ComercialFilters
              empresas={empresas}
              empresaFilter={empresaFilter}
              onEmpresaChange={setEmpresaFilter}
              regiaoFilter={regiaoFilter}
              onRegiaoChange={setRegiaoFilter}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>
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

        {/* Separator - Normalização */}
        <div className="flex items-center gap-3 pt-2">
          <Separator className="flex-1" />
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Qualidade dos Dados
          </span>
          <Separator className="flex-1" />
        </div>

        {/* Normalization Report */}
        <NormalizationReportCard
          resumo={resumo}
          isLoading={loadingNormalizacao}
          onNormalizar={executarNormalizacao}
          isNormalizando={isNormalizando}
          resultado={resultadoNormalizacao}
          onRecalcular={recalcularCobertura}
          isRecalculando={isRecalculando}
        />
      </div>
    </DashboardLayout>
  );
};

export default MarketIntelligence;
