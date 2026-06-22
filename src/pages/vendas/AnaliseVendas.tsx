import { useState } from "react";
import { format } from "date-fns";
import { BarChart3 } from "lucide-react";
import { FiltrosBar } from "@/components/vendas/FiltrosBar";
import { KPICards } from "@/components/vendas/KPICards";
import { EvolucaoMensalChart } from "@/components/vendas/EvolucaoMensalChart";
import { RankingTabs } from "@/components/vendas/RankingTabs";
import { TopClientesTable } from "@/components/vendas/TopClientesTable";
import { NotasPeriodoTable } from "@/components/vendas/NotasPeriodoTable";
import { useVendasKpis, useVendasSerieMensal, type VendasFilters } from "@/hooks/useVendasAnalise";

function defaultFilters(): VendasFilters {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    de: format(first, "yyyy-MM-dd"),
    ate: format(now, "yyyy-MM-dd"),
    empresa: null,
    vendedor: null,
    coordenador: null,
  };
}

export default function AnaliseVendas() {
  const [filters, setFilters] = useState<VendasFilters>(defaultFilters);

  const kpis = useVendasKpis(filters);
  const serie = useVendasSerieMensal(filters);

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Análise de Vendas</h1>
          <p className="text-sm text-muted-foreground">KPIs, rankings e detalhamento de notas por período</p>
        </div>
      </div>

      <FiltrosBar value={filters} onChange={setFilters} />

      <KPICards data={kpis.data} isLoading={kpis.isLoading} />

      <EvolucaoMensalChart data={serie.data} isLoading={serie.isLoading} />

      <RankingTabs filters={filters} />

      <TopClientesTable filters={filters} />

      <NotasPeriodoTable filters={filters} />
    </div>
  );
}
