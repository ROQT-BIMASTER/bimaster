import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { HeaderResult } from "@/components/vendas/result/HeaderResult";
import { FiltrosGlobaisResult, type ResultFilters } from "@/components/vendas/result/FiltrosGlobaisResult";
import { KPICardsResult } from "@/components/vendas/result/KPICardsResult";
import { NotasPeriodoResultTable } from "@/components/vendas/result/NotasPeriodoResultTable";
import { BlocoRankingVendedor } from "@/components/vendas/BlocoRankingVendedor";
import { BlocoScatterClientes } from "@/components/vendas/BlocoScatterClientes";
import { BlocoMensalYoY } from "@/components/vendas/BlocoMensalYoY";
import { BlocoRankingYoy } from "@/components/vendas/BlocoRankingYoy";
import { useVendasKpis, type VendasFilters } from "@/hooks/useVendasAnalise";
import { computeVendasRange } from "@/hooks/vendas/vendasFilters";

const nowY = new Date().getFullYear();

export default function VendasResultPage() {
  const anos = [nowY, nowY - 1, nowY - 2];
  const [filters, setFilters] = useState<ResultFilters>({
    ano: nowY,
    mes: null,
    empresa: null,
    vendedorId: null,
  });

  const { ano, mes, empresa, vendedorId } = filters;

  const rangeFilters: VendasFilters = useMemo(() => {
    const { de, ate } = computeVendasRange(ano, mes);
    return {
      de,
      ate,
      empresa,
      vendedor: null,
      coordenador: null,
      tabelaPrecoId: null,
      uf: null,
      clienteId: null,
      vendedorId,
    };
  }, [ano, mes, empresa, vendedorId]);

  const kpis = useVendasKpis(rangeFilters, "rubysp");

  return (
    <DashboardLayout>
      <div className="resultados-vendas-theme min-h-screen bg-rv-bg text-rv-ink">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20 py-8">
          <HeaderResult
            ano={ano}
            onAnoChange={(a) => setFilters((f) => ({ ...f, ano: a }))}
            anos={anos}
          />

          <FiltrosGlobaisResult filters={filters} onChange={setFilters} anos={anos} />

          <div className="pt-6">
            <KPICardsResult data={kpis.data} isLoading={kpis.isLoading} ano={ano} />
          </div>

          <div className="pt-6">
            <BlocoRankingVendedor filters={rangeFilters} source="rubysp" />
          </div>

          <BlocoScatterClientes
            de={rangeFilters.de!}
            ate={rangeFilters.ate!}
            empresa={empresa}
            vendedorId={vendedorId}
            source="rubysp"
          />

          <BlocoMensalYoY ano={ano} mes={mes} empresa={empresa} vendedorId={vendedorId} source="rubysp" />

          <BlocoRankingYoy ano={ano} mes={mes} empresa={empresa} vendedorId={vendedorId} source="rubysp" />

          <div className="pt-14">
            <NotasPeriodoResultTable
              de={rangeFilters.de!}
              ate={rangeFilters.ate!}
              empresa={empresa}
              vendedor={vendedorId}
            />
          </div>

          <div className="h-16" />
        </div>
      </div>
    </DashboardLayout>
  );
}
