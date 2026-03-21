import { useState, useCallback } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import { KPICards } from "@/components/painel-executivo/KPICards";
import { ReceitaMensalChart } from "@/components/painel-executivo/ReceitaMensalChart";
import { ReceitaEmpresaChart } from "@/components/painel-executivo/ReceitaEmpresaChart";
import { RankingSupervisoresChart } from "@/components/painel-executivo/RankingSupervisoresChart";
import { RankingVendedoresChart } from "@/components/painel-executivo/RankingVendedoresChart";
import { useDashboardKPIs, type DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useReceitaMensal } from "@/hooks/useReceitaMensal";
import { useReceitaEmpresa } from "@/hooks/useReceitaEmpresa";
import { useRankingSupervisores } from "@/hooks/useRankingSupervisores";
import { useRankingVendedores } from "@/hooks/useRankingVendedores";
import { ValueLegend } from "@/components/ui/smart-value";
import { BarChart3 } from "lucide-react";

const now = new Date();

export default function PainelExecutivo() {
  const [filters, setFilters] = useState<DashboardFilters>({
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
  });

  const handleFilterChange = useCallback((partial: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const kpis = useDashboardKPIs(filters);
  const receitaMensal = useReceitaMensal(filters);
  const receitaEmpresa = useReceitaEmpresa(filters);
  const rankingSupervisores = useRankingSupervisores(filters);
  const rankingVendedores = useRankingVendedores(filters);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Painel Executivo</h1>
            <p className="text-sm text-muted-foreground">Visão consolidada de vendas e desempenho</p>
          </div>
        </div>
        <ValueLegend />
      </div>

      {/* Filters */}
      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />

      {/* KPI Cards */}
      <KPICards data={kpis.data} isLoading={kpis.isLoading} />

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ReceitaMensalChart data={receitaMensal.data} isLoading={receitaMensal.isLoading} />
        <ReceitaEmpresaChart data={receitaEmpresa.data} isLoading={receitaEmpresa.isLoading} />
        <RankingSupervisoresChart data={rankingSupervisores.data} isLoading={rankingSupervisores.isLoading} />
        <RankingVendedoresChart data={rankingVendedores.data} isLoading={rankingVendedores.isLoading} />
      </div>
    </div>
  );
}
