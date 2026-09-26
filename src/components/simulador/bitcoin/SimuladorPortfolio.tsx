import { Bitcoin, Landmark, PiggyBank, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCurrency } from "@/lib/formatters";
import { formatBtc, type Equity, type Portfolio } from "@/lib/simulador/btcMarketEngine";

interface Props {
  portfolio: Portfolio;
  equity: Equity;
}

export function SimuladorPortfolio({ portfolio, equity }: Props) {
  const totalUp = equity.resultadoTotal >= 0;
  const posUp = equity.resultadoNaoRealizado >= 0;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Patrimônio total"
        value={formatCurrency(equity.patrimonio)}
        subtitle="Reais + posição em BTC a mercado"
        icon={PiggyBank}
        variant={totalUp ? "success" : "destructive"}
        trend={{ value: Number(equity.resultadoTotalPct.toFixed(2)), label: "desde o início" }}
      />
      <KpiCard
        title="Saldo em reais"
        value={formatCurrency(equity.disponivelBrl)}
        subtitle={portfolio.reservadoBrl > 0 ? `Reservado em ordens: ${formatCurrency(portfolio.reservadoBrl)}` : `Disponível para compra · Taxas pagas ${formatCurrency(portfolio.totalTaxas)}`}
        icon={Landmark}
        variant="default"
      />
      <KpiCard
        title="Posição em BTC"
        value={`${formatBtc(portfolio.saldoBtc)} BTC`}
        subtitle={
          portfolio.saldoBtc > 0
            ? `${formatCurrency(equity.valorBtc)} · preço médio ${formatCurrency(portfolio.precoMedio)}`
            : "Nenhuma posição aberta"
        }
        icon={Bitcoin}
        variant="warning"
      />
      <KpiCard
        title="Resultado"
        value={`${totalUp ? "+" : ""}${formatCurrency(equity.resultadoTotal)}`}
        subtitle={`Realizado ${formatCurrency(portfolio.resultadoRealizado)} · Aberto ${posUp ? "+" : ""}${formatCurrency(equity.resultadoNaoRealizado)}`}
        icon={TrendingUp}
        variant={totalUp ? "success" : "destructive"}
      />
    </div>
  );
}
