import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/formatters";
import {
  TAXA_MAKER,
  TAXA_TAKER,
  formatBtc,
  roundBtc,
  type OrderSide,
  type OrderType,
} from "@/lib/simulador/btcMarketEngine";
import type { Equity } from "@/lib/simulador/btcMarketEngine";
import { parseNumberInput } from "@/lib/simulador/parseNumberInput";

interface Props {
  price: number;
  bestAsk: number;
  bestBid: number;
  equity: Equity;
  selectedPrice: number | null;
  onBuyMarket: (amount: number) => boolean;
  onSellMarket: (amount: number) => boolean;
  onPlaceLimit: (side: OrderSide, amount: number, price: number) => boolean;
}

const fmtInputBrl = (v: number) => (Number.isFinite(v) ? v.toFixed(2).replace(".", ",") : "");
const fmtInputBtc = (v: number) => (Number.isFinite(v) ? roundBtc(v).toFixed(8).replace(".", ",") : "");

export function SimuladorOrderForm({
  price,
  bestAsk,
  bestBid,
  equity,
  selectedPrice,
  onBuyMarket,
  onSellMarket,
  onPlaceLimit,
}: Props) {
  const [side, setSide] = useState<OrderSide>("buy");
  const [type, setType] = useState<OrderType>("market");
  const [limitInput, setLimitInput] = useState<string>(fmtInputBrl(price));
  const [amountInput, setAmountInput] = useState<string>("");
  const [totalInput, setTotalInput] = useState<string>("");
  const [pct, setPct] = useState<number>(0);

  // Preço clicado no book preenche o preço limite.
  useEffect(() => {
    if (selectedPrice != null) {
      setLimitInput(fmtInputBrl(selectedPrice));
      setType("limit");
    }
  }, [selectedPrice]);

  const feeRate = type === "market" ? TAXA_TAKER : TAXA_MAKER;
  const execPrice = useMemo(() => {
    if (type === "limit") {
      const p = parseNumberInput(limitInput);
      return Number.isFinite(p) && p > 0 ? p : price;
    }
    return side === "buy" ? bestAsk : bestBid;
  }, [type, limitInput, price, side, bestAsk, bestBid]);

  const amount = parseNumberInput(amountInput);
  const total = Number.isFinite(amount) ? amount * execPrice : NaN;
  const fee = Number.isFinite(total) ? total * feeRate : NaN;

  const maxAmount = useMemo(() => {
    if (side === "sell") return equity.disponivelBtc;
    return execPrice > 0 ? roundBtc(equity.disponivelBrl / (execPrice * (1 + feeRate))) : 0;
  }, [side, equity, execPrice, feeRate]);

  const setAmount = (v: number) => {
    setAmountInput(fmtInputBtc(v));
    setTotalInput(fmtInputBrl(v * execPrice));
  };

  const handleAmountChange = (raw: string) => {
    setAmountInput(raw);
    const n = parseNumberInput(raw);
    setTotalInput(Number.isFinite(n) ? fmtInputBrl(n * execPrice) : "");
    setPct(maxAmount > 0 && Number.isFinite(n) ? Math.min(100, Math.round((n / maxAmount) * 100)) : 0);
  };

  const handleTotalChange = (raw: string) => {
    setTotalInput(raw);
    const n = parseNumberInput(raw);
    const a = Number.isFinite(n) && execPrice > 0 ? n / execPrice : NaN;
    setAmountInput(Number.isFinite(a) ? fmtInputBtc(a) : "");
    setPct(maxAmount > 0 && Number.isFinite(a) ? Math.min(100, Math.round((a / maxAmount) * 100)) : 0);
  };

  const applyPct = (p: number) => {
    setPct(p);
    setAmount(roundBtc((maxAmount * p) / 100));
  };

  const submit = () => {
    let ok = false;
    if (type === "market") {
      ok = side === "buy" ? onBuyMarket(amount) : onSellMarket(amount);
    } else {
      ok = onPlaceLimit(side, amount, parseNumberInput(limitInput));
    }
    if (ok) {
      setAmountInput("");
      setTotalInput("");
      setPct(0);
    }
  };

  const isBuy = side === "buy";
  const disabled = !Number.isFinite(amount) || amount <= 0 || amount > maxAmount + 1e-9;

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border p-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => { setSide("buy"); setPct(0); setAmountInput(""); setTotalInput(""); }}
            className={cn(
              "rounded-md py-1.5 text-sm font-semibold transition-colors",
              isBuy ? "bg-success text-success-foreground shadow" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Comprar
          </button>
          <button
            type="button"
            onClick={() => { setSide("sell"); setPct(0); setAmountInput(""); setTotalInput(""); }}
            className={cn(
              "rounded-md py-1.5 text-sm font-semibold transition-colors",
              !isBuy ? "bg-destructive text-destructive-foreground shadow" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Vender
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <Tabs value={type} onValueChange={(v) => setType(v as OrderType)}>
          <TabsList className="h-8 w-full">
            <TabsTrigger value="market" className="flex-1 text-xs">Mercado</TabsTrigger>
            <TabsTrigger value="limit" className="flex-1 text-xs">Limite</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Disponível</span>
          <span className="font-mono tabular-nums text-foreground">
            {isBuy ? formatCurrency(equity.disponivelBrl) : `${formatBtc(equity.disponivelBtc)} BTC`}
          </span>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Preço (BRL)</Label>
          {type === "market" ? (
            <Input value="Melhor preço de mercado" disabled className="h-9 font-mono text-sm" />
          ) : (
            <Input
              inputMode="decimal"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              className="h-9 font-mono text-sm tabular-nums"
            />
          )}
          <div className="text-[11px] text-muted-foreground">
            {type === "market" ? `≈ ${formatCurrency(execPrice)}` : `Último: ${formatCurrency(price)}`}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Quantidade (BTC)</Label>
          <Input
            inputMode="decimal"
            placeholder="0,00000000"
            value={amountInput}
            onChange={(e) => handleAmountChange(e.target.value)}
            className="h-9 font-mono text-sm tabular-nums"
          />
        </div>

        <div className="space-y-2 px-1">
          <Slider value={[pct]} max={100} step={1} onValueChange={(v) => applyPct(v[0] ?? 0)} />
          <div className="grid grid-cols-4 gap-1">
            {[25, 50, 75, 100].map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={pct === p ? "secondary" : "outline"}
                className="h-6 text-[11px]"
                onClick={() => applyPct(p)}
              >
                {p}%
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Total (BRL)</Label>
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={totalInput}
            onChange={(e) => handleTotalChange(e.target.value)}
            className="h-9 font-mono text-sm tabular-nums"
          />
        </div>

        <div className="mt-auto space-y-1 rounded-md bg-muted/50 p-2 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Taxa ({(feeRate * 100).toFixed(2)}%)</span>
            <span className="font-mono tabular-nums">{Number.isFinite(fee) ? formatCurrency(fee) : "—"}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>{isBuy ? "Total a pagar" : "Total a receber"}</span>
            <span className="font-mono tabular-nums">
              {Number.isFinite(total) ? formatCurrency(isBuy ? total + fee : total - fee) : "—"}
            </span>
          </div>
        </div>

        <Button
          type="button"
          onClick={submit}
          disabled={disabled}
          className={cn(
            "h-10 w-full text-sm font-semibold",
            isBuy
              ? "bg-success text-success-foreground hover:bg-success/90"
              : "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          )}
        >
          {isBuy ? "Comprar BTC" : "Vender BTC"}
        </Button>
        <p className="text-center text-[10px] text-muted-foreground">
          Ambiente de simulação. Nenhuma operação real é realizada.
        </p>
      </div>
    </div>
  );
}
