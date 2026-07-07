import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { HeaderResultados } from "@/components/vendas/HeaderResultados";
import { FiltrosGlobaisVendas } from "@/components/vendas/FiltrosGlobaisVendas";
import { BlocoRankingVendedor } from "@/components/vendas/BlocoRankingVendedor";
import { BlocoScatterClientes } from "@/components/vendas/BlocoScatterClientes";
import { BlocoMensalYoY } from "@/components/vendas/BlocoMensalYoY";
import { BlocoShareTabelaPreco } from "@/components/vendas/BlocoShareTabelaPreco";
import { BlocoRankingYoy } from "@/components/vendas/BlocoRankingYoy";
import { BlocoUfYoY } from "@/components/vendas/BlocoUfYoY";
import { PedidosCopilotDrawer } from "@/components/fornecedor/pedidos/PedidosCopilotDrawer";
import { initialGlobalFilters, computeVendasRange, type VendasGlobalFilters } from "@/hooks/vendas/vendasFilters";
import type { VendasFilters } from "@/hooks/useVendasAnalise";

const nowY = new Date().getFullYear();

export default function ResultadosVendas() {
  const anos = [nowY, nowY - 1, nowY - 2];
  const [filters, setFilters] = useState<VendasGlobalFilters>(() => initialGlobalFilters(nowY));

  const { ano, mes, empresa, tabelaPrecoId, uf, clienteId, vendedorId } = filters;
  const [copilotOpen, setCopilotOpen] = useState(false);

  const rankingFilters: VendasFilters = useMemo(() => {
    const { de, ate } = computeVendasRange(ano, mes);
    return {
      de,
      ate,
      empresa,
      vendedor: null,
      coordenador: null,
      tabelaPrecoId, uf, clienteId, vendedorId,
    };
  }, [ano, mes, empresa, tabelaPrecoId, uf, clienteId, vendedorId]);

  return (
    <DashboardLayout>
      <div className="resultados-vendas-theme min-h-screen bg-rv-bg text-rv-ink">
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20 py-8">
          <HeaderResultados
            ano={ano}
            onAnoChange={(a) => setFilters((f) => ({ ...f, ano: a }))}
            anos={anos}
          />

          <FiltrosGlobaisVendas filters={filters} onChange={setFilters} anos={anos} />

          <div className="pt-6">
            <BlocoRankingVendedor filters={rankingFilters} />
          </div>

          <BlocoScatterClientes
            de={rankingFilters.de!}
            ate={rankingFilters.ate!}
            empresa={empresa}
            tabelaPrecoId={tabelaPrecoId}
            uf={uf}
            clienteId={clienteId}
            vendedorId={vendedorId}
          />

          <div className="grid md:grid-cols-12 gap-10">
            <div className="md:col-span-7">
              <BlocoMensalYoY
                ano={ano} mes={mes} empresa={empresa}
                tabelaPrecoId={tabelaPrecoId} uf={uf}
                clienteId={clienteId} vendedorId={vendedorId}
              />
            </div>
            <div className="md:col-span-5">
              <BlocoShareTabelaPreco
                de={rankingFilters.de!} ate={rankingFilters.ate!}
                empresa={empresa} ano={ano}
                tabelaPrecoId={tabelaPrecoId} uf={uf}
                clienteId={clienteId} vendedorId={vendedorId}
              />
            </div>
          </div>

          <BlocoUfYoY
            ano={ano} mes={mes} empresa={empresa}
            tabelaPrecoId={tabelaPrecoId}
            clienteId={clienteId} vendedorId={vendedorId}
          />

          <BlocoRankingYoy
            ano={ano} mes={mes} empresa={empresa}
            tabelaPrecoId={tabelaPrecoId} uf={uf}
            clienteId={clienteId} vendedorId={vendedorId}
          />

          <div className="h-16" />
        </div>

        <Button
          size="sm"
          onClick={() => setCopilotOpen(true)}
          className="fixed bottom-6 right-6 z-40 gap-2 bg-pink-600 hover:bg-pink-700 text-white shadow-lg"
        >
          <Sparkles className="h-4 w-4" />
          Copiloto
        </Button>

        <PedidosCopilotDrawer
          open={copilotOpen}
          onOpenChange={setCopilotOpen}
          scope={{ date_from: rankingFilters.de, date_to: rankingFilters.ate }}
        />
      </div>
    </DashboardLayout>
  );
}
