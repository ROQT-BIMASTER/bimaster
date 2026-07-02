import { useMemo, useState } from "react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { HeaderResultados } from "@/components/vendas/HeaderResultados";
import { BlocoRankingVendedor } from "@/components/vendas/BlocoRankingVendedor";
import { BlocoScatterClientes } from "@/components/vendas/BlocoScatterClientes";
import { BlocoMensalYoY } from "@/components/vendas/BlocoMensalYoY";
import { BlocoShareTabelaPreco } from "@/components/vendas/BlocoShareTabelaPreco";
import { BlocoRankingYoy } from "@/components/vendas/BlocoRankingYoy";
import type { VendasFilters } from "@/hooks/useVendasAnalise";

const nowY = new Date().getFullYear();

export default function ResultadosVendas() {
  const [ano, setAno] = useState<number>(nowY);
  const [empresa] = useState<number | null>(null);
  const anos = [nowY, nowY - 1, nowY - 2];

  const filters: VendasFilters = useMemo(() => ({
    de: `${ano}-01-01`,
    ate: ano === nowY ? format(new Date(), "yyyy-MM-dd") : `${ano}-12-31`,
    empresa,
    vendedor: null,
    coordenador: null,
  }), [ano, empresa]);

  return (
    <DashboardLayout>
      <div className="resultados-vendas-theme min-h-screen bg-rv-bg text-rv-ink">
        <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-8">
          <HeaderResultados ano={ano} onAnoChange={setAno} anos={anos} />

          <BlocoRankingVendedor filters={filters} />

          <BlocoScatterClientes de={filters.de!} ate={filters.ate!} empresa={empresa} />

          <div className="grid md:grid-cols-12 gap-10">
            <div className="md:col-span-7">
              <BlocoMensalYoY ano={ano} empresa={empresa} />
            </div>
            <div className="md:col-span-5">
              <BlocoShareTabelaPreco de={filters.de!} ate={filters.ate!} empresa={empresa} ano={ano} />
            </div>
          </div>

          <BlocoRankingYoy ano={ano} empresa={empresa} />

          <div className="h-16" />
        </div>
      </div>
    </DashboardLayout>
  );
}
