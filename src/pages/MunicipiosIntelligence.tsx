import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useMunicipiosIntelligence } from "@/hooks/useMunicipiosIntelligence";
import { MunicipiosFiltersBar } from "@/components/comercial/municipios/MunicipiosFilters";
import { MunicipiosKPICards } from "@/components/comercial/municipios/MunicipiosKPICards";
import { MunicipiosScatterChart } from "@/components/comercial/municipios/MunicipiosScatterChart";
import { MunicipiosOpportunityCard } from "@/components/comercial/municipios/MunicipiosOpportunityCard";
import { MunicipiosTable } from "@/components/comercial/municipios/MunicipiosTable";
import { Building2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

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
    fetchAllForExport,
    pageSize,
  } = useMunicipiosIntelligence();

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
        <div className="grid gap-6 lg:grid-cols-2">
          <MunicipiosScatterChart data={municipios} loading={dataLoading} />
          <MunicipiosOpportunityCard data={municipios} loading={dataLoading} />
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
