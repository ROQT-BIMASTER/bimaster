import { useState, useCallback } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import type { DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useDetalhamentoVendas } from "@/hooks/useDetalhamentoVendas";
import { DetalhamentoTable } from "@/components/detalhamento/DetalhamentoTable";
import { ValueLegend } from "@/components/ui/smart-value";
import { FileText } from "lucide-react";

const now = new Date();

export default function DetalhamentoVendas() {
  const [filters, setFilters] = useState<DashboardFilters>({
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
  });

  const handleFilterChange = useCallback((partial: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const { data, isLoading, totalRows } = useDetalhamentoVendas(filters);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Detalhamento de Vendas</h1>
            <p className="text-sm text-muted-foreground">
              Dados completos de vendas {totalRows > 0 ? `(${totalRows.toLocaleString("pt-BR")} registros)` : ""}
            </p>
          </div>
        </div>
        <ValueLegend />
      </div>

      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />
      <DetalhamentoTable data={data} isLoading={isLoading} />
    </div>
  );
}
