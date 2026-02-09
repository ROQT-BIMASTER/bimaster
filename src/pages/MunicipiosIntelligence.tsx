import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useMunicipiosIntelligence } from "@/hooks/useMunicipiosIntelligence";
import { MunicipiosFiltersBar } from "@/components/comercial/municipios/MunicipiosFilters";
import { MunicipiosKPICards } from "@/components/comercial/municipios/MunicipiosKPICards";
import { MunicipiosScatterChart } from "@/components/comercial/municipios/MunicipiosScatterChart";
import { MunicipiosOpportunityCard } from "@/components/comercial/municipios/MunicipiosOpportunityCard";
import { MunicipiosTable } from "@/components/comercial/municipios/MunicipiosTable";
import { Progress } from "@/components/ui/progress";
import { Building2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const MunicipiosIntelligence = () => {
  const {
    filters,
    updateFilter,
    toggleSort,
    kpis,
    kpisLoading,
    municipios,
    totalCount,
    totalPages,
    dataLoading,
    topOpportunities,
    topOpportunitiesLoading,
    fetchAllForExport,
    pageSize,
  } = useMunicipiosIntelligence();

  const isInitialLoading = kpisLoading && dataLoading && topOpportunitiesLoading;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isInitialLoading) {
      setProgress(100);
      return;
    }
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 12;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [isInitialLoading]);

  if (isInitialLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Building2 className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-semibold">Carregando Inteligência Municipal</h2>
            <p className="text-sm text-muted-foreground">
              Processando dados de 5.571 municípios...
            </p>
          </div>
          <div className="w-64">
            <Progress value={progress} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Breadcrumb + Header */}
        <div>
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
            <Link to="/dashboard/comercial" className="hover:text-foreground transition-colors">
              Comercial
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to="/dashboard/comercial/inteligencia" className="hover:text-foreground transition-colors">
              Inteligência Comercial
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium">Municípios</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Inteligência Municipal</h1>
              <p className="text-muted-foreground text-sm">
                Análise estratégica dos 5.571 municípios brasileiros — cruzamento IBGE × dados comerciais
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <MunicipiosFiltersBar filters={filters} onFilterChange={updateFilter} />

        {/* KPI Cards */}
        <MunicipiosKPICards kpis={kpis} loading={kpisLoading} />

        {/* Charts Row */}
        <div className="grid gap-4 lg:grid-cols-2">
          <MunicipiosScatterChart kpis={kpis} loading={kpisLoading} />
          <MunicipiosOpportunityCard data={topOpportunities} loading={topOpportunitiesLoading} />
        </div>

        {/* Full Table */}
        <MunicipiosTable
          data={municipios}
          loading={dataLoading}
          filters={filters}
          totalCount={totalCount}
          totalPages={totalPages}
          pageSize={pageSize}
          onSort={toggleSort}
          onPageChange={(page) => updateFilter('page', page)}
          fetchAllForExport={fetchAllForExport}
        />
      </div>
    </DashboardLayout>
  );
};

export default MunicipiosIntelligence;
