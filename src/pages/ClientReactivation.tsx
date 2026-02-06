import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, RefreshCw, Building2 } from "lucide-react";
import { useClienteReativacao, type RiskLevel } from "@/hooks/useClienteReativacao";
import { ReactivationKPICards } from "@/components/comercial/ReactivationKPICards";
import { RiskFunnelChart } from "@/components/comercial/RiskFunnelChart";
import { InactivityDistributionChart } from "@/components/comercial/InactivityDistributionChart";
import { ReactivationTable } from "@/components/comercial/ReactivationTable";
import { RiskByStateCard } from "@/components/comercial/RiskByStateCard";
import { Skeleton } from "@/components/ui/skeleton";

const ClientReactivation = () => {
  const [empresaFilter, setEmpresaFilter] = useState<number | null>(null);
  const { data, isLoading, refetch, isFetching, empresas } = useClienteReativacao(empresaFilter);
  const [activeRiskFilter, setActiveRiskFilter] = useState<RiskLevel | null>(null);

  const handleFilterClick = (nivel: RiskLevel) => {
    setActiveRiskFilter((prev) => (prev === nivel ? null : nivel));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to="/dashboard/comercial">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Painel de Reativação</h1>
              <p className="text-sm text-muted-foreground">
                Clientes que precisam de contato urgente para reativação comercial
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select
                value={empresaFilter?.toString() ?? "todas"}
                onValueChange={(v) => setEmpresaFilter(v === "todas" ? null : Number(v))}
              >
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="Todas as filiais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as filiais</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[120px] rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-[280px] rounded-xl" />
            <Skeleton className="h-[300px] rounded-xl" />
          </div>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <ReactivationKPICards
              kpis={data.kpis}
              onFilterClick={handleFilterClick}
              activeFilter={activeRiskFilter}
            />

            {/* Charts Row */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <RiskFunnelChart kpis={data.kpis} />
              </div>
              <div className="lg:col-span-2">
                <RiskByStateCard data={data.riscoPorUF} />
              </div>
            </div>

            {/* Distribution Chart */}
            <InactivityDistributionChart clientes={data.clientes} />

            {/* Table */}
            <ReactivationTable
              clientes={data.clientes}
              filterRisco={activeRiskFilter}
            />
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default ClientReactivation;
