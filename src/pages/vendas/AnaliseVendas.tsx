import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { FiltrosBar } from "@/components/vendas/FiltrosBar";
import { KPICards } from "@/components/vendas/KPICards";
import { EvolucaoMensalChart } from "@/components/vendas/EvolucaoMensalChart";
import { RankingTabs } from "@/components/vendas/RankingTabs";
import { TopClientesTable } from "@/components/vendas/TopClientesTable";
import { NotasPeriodoTable } from "@/components/vendas/NotasPeriodoTable";
import { UnidadeToggle, loadUnidade } from "@/components/vendas/UnidadeToggle";
import { useVendasKpis, useVendasSerieMensal, type VendasFilters } from "@/hooks/useVendasAnalise";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { FuturaBackButton } from "@/components/fornecedor/FuturaBackButton";
import type { Unidade } from "@/lib/vendas/unidade";

function defaultFilters(): VendasFilters {
  const now = new Date();
  const first = new Date(now.getFullYear(), 0, 1);
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

  const periodoLabel =
    filters.de && filters.ate
      ? `${format(parseLocalDate(filters.de), "dd/MM/yyyy", { locale: ptBR })} – ${format(parseLocalDate(filters.ate), "dd/MM/yyyy", { locale: ptBR })}`
      : "—";

  const ano = filters.de ? parseLocalDate(filters.de).getFullYear() : new Date().getFullYear();

  return (
    <DashboardLayout>
      <div className="vendas-theme min-h-screen" style={{ background: "hsl(var(--vendas-bg))" }}>
        <div className="w-full px-4 md:px-6 py-6 space-y-5">
          <FuturaBackButton />
          <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Análise de Vendas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Vendas faturadas (saída) · ano de {ano}
            </p>
          </div>
          <div className="rounded-full bg-card border border-border px-4 py-2 text-xs text-muted-foreground shadow-sm">
            Período: <span className="font-medium text-foreground">{periodoLabel}</span>
          </div>
        </div>

        <FiltrosBar value={filters} onChange={setFilters} />

        <KPICards data={kpis.data} isLoading={kpis.isLoading} ano={ano} />

        <EvolucaoMensalChart data={serie.data} isLoading={serie.isLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <RankingTabs filters={filters} />
          <TopClientesTable filters={filters} />
        </div>

        <NotasPeriodoTable filters={filters} />
      </div>
    </div>
    </DashboardLayout>
  );
}
