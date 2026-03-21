import { useState, useCallback, useMemo } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import type { DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useClientesDashboard } from "@/hooks/useClientesDashboard";
import { ClientesKPICards } from "@/components/clientes-dashboard/ClientesKPICards";
import { ClientesParetoChart } from "@/components/clientes-dashboard/ClientesParetoChart";
import { ClientesUFTreemap } from "@/components/clientes-dashboard/ClientesUFTreemap";
import { ClientesFaixaReceita } from "@/components/clientes-dashboard/ClientesFaixaReceita";
import { ClientesDetalheTable } from "@/components/clientes-dashboard/ClientesDetalheTable";
import { ClienteDrilldownModal } from "@/components/clientes-dashboard/ClienteDrilldownModal";
import { ValueLegend } from "@/components/ui/smart-value";
import { Users } from "lucide-react";

const now = new Date();

export default function AnaliseClientes() {
  const [filters, setFilters] = useState<DashboardFilters>({
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
  });
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null);

  const handleFilterChange = useCallback((partial: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const { kpis, clientesDetail, paretoData, ufData, faixaData, isLoading } = useClientesDashboard(filters);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Análise de Clientes</h1>
            <p className="text-sm text-muted-foreground">Visão completa da carteira de clientes</p>
          </div>
        </div>
        <ValueLegend />
      </div>

      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />
      <ClientesKPICards data={kpis} isLoading={isLoading} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ClientesParetoChart data={paretoData} isLoading={isLoading} />
        <ClientesUFTreemap data={ufData} isLoading={isLoading} />
      </div>

      <ClientesFaixaReceita data={faixaData} isLoading={isLoading} />
      <ClientesDetalheTable data={clientesDetail} isLoading={isLoading} onClienteClick={setSelectedCliente} />

      {selectedCliente && (
        <ClienteDrilldownModal
          codCliente={selectedCliente}
          filters={filters}
          onClose={() => setSelectedCliente(null)}
        />
      )}
    </div>
  );
}
