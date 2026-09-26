import { useState } from "react";
import { Info, Pause, Play, RotateCcw } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useBtcSimulator } from "@/hooks/useBtcSimulator";
import { SimuladorPriceHeader } from "@/components/simulador/bitcoin/SimuladorPriceHeader";
import { SimuladorChart } from "@/components/simulador/bitcoin/SimuladorChart";
import { SimuladorOrderBook } from "@/components/simulador/bitcoin/SimuladorOrderBook";
import { SimuladorOrderForm } from "@/components/simulador/bitcoin/SimuladorOrderForm";
import { SimuladorPortfolio } from "@/components/simulador/bitcoin/SimuladorPortfolio";
import { SimuladorOrdens } from "@/components/simulador/bitcoin/SimuladorOrdens";
import { formatCurrency } from "@/lib/formatters";
import { SALDO_INICIAL_BRL } from "@/lib/simulador/btcMarketEngine";

export function SimuladorBitcoinContent() {
  const sim = useBtcSimulator();
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulador de Investimento em Bitcoin</h1>
          <p className="text-sm text-muted-foreground">
            Carteira virtual de {formatCurrency(SALDO_INICIAL_BRL)} para praticar compra e venda com cotação simulada em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => sim.setRunning(!sim.running)}>
            {sim.running ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
            {sim.running ? "Pausar cotação" : "Retomar cotação"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reiniciar simulação
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reiniciar a simulação?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todas as ordens e posições serão apagadas e o saldo voltará para {formatCurrency(SALDO_INICIAL_BRL)}.
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={sim.reset}>Reiniciar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>
          Ambiente de simulação para treino. Os preços são gerados localmente e não refletem o mercado real.
          Nenhum valor é movimentado e nenhuma integração externa é acionada. O progresso fica salvo apenas neste navegador.
        </span>
      </div>

      <SimuladorPriceHeader price={sim.price} direction={sim.direction} stats={sim.stats24h} />

      <SimuladorPortfolio portfolio={sim.portfolio} equity={sim.equity} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-3 lg:min-h-[520px]">
          <SimuladorOrderBook
            book={sim.orderBook}
            price={sim.price}
            direction={sim.direction}
            onSelectPrice={setSelectedPrice}
          />
        </div>
        <div className="lg:col-span-6 lg:min-h-[520px]">
          <SimuladorChart
            candles={sim.candles}
            timeframe={sim.timeframe}
            onTimeframeChange={sim.changeTimeframe}
            price={sim.price}
          />
        </div>
        <div className="lg:col-span-3 lg:min-h-[520px]">
          <SimuladorOrderForm
            price={sim.price}
            bestAsk={sim.orderBook.asks[0]?.price ?? sim.price}
            bestBid={sim.orderBook.bids[0]?.price ?? sim.price}
            equity={sim.equity}
            selectedPrice={selectedPrice}
            onBuyMarket={sim.buyMarket}
            onSellMarket={sim.sellMarket}
            onPlaceLimit={sim.placeLimit}
          />
        </div>
      </div>

      <SimuladorOrdens
        openOrders={sim.openOrders}
        history={sim.history}
        trades={sim.trades}
        onCancel={sim.cancelOrder}
      />
    </div>
  );
}

export default function SimuladorBitcoin() {
  return (
    <DashboardLayout>
      <SimuladorBitcoinContent />
    </DashboardLayout>
  );
}
