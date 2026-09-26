import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { formatBtc, type OrderBook, type OrderBookLevel } from "@/lib/simulador/btcMarketEngine";

interface Props {
  book: OrderBook;
  price: number;
  direction: "up" | "down";
  onSelectPrice?: (price: number) => void;
}

function Row({
  level,
  maxTotal,
  side,
  onClick,
}: {
  level: OrderBookLevel;
  maxTotal: number;
  side: "bid" | "ask";
  onClick?: () => void;
}) {
  const pct = Math.min(100, (level.total / maxTotal) * 100);
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative grid w-full grid-cols-3 px-3 py-[3px] text-left font-mono text-[11px] tabular-nums hover:bg-muted/60"
    >
      <span
        className={cn("absolute inset-y-0 right-0", side === "bid" ? "bg-success/10" : "bg-destructive/10")}
        style={{ width: `${pct}%` }}
      />
      <span className={cn("relative", side === "bid" ? "text-success" : "text-destructive")}>
        {formatNumber(level.price, 2)}
      </span>
      <span className="relative text-right text-foreground">{formatBtc(level.amount, 5)}</span>
      <span className="relative text-right text-muted-foreground">{formatBtc(level.total, 4)}</span>
    </button>
  );
}

export function SimuladorOrderBook({ book, price, direction, onSelectPrice }: Props) {
  const maxTotal = Math.max(
    book.bids[book.bids.length - 1]?.total ?? 1,
    book.asks[book.asks.length - 1]?.total ?? 1,
  );
  const asksDesc = [...book.asks].reverse();

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-semibold">Book de ofertas</span>
        <span className="text-[11px] text-muted-foreground">
          Spread {formatCurrency(book.spread)} ({book.spreadPct.toFixed(3)}%)
        </span>
      </div>
      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>Preço (BRL)</span>
        <span className="text-right">Qtd (BTC)</span>
        <span className="text-right">Total</span>
      </div>

      <div className="flex-1">
        {asksDesc.map((l) => (
          <Row key={`a-${l.price}`} level={l} maxTotal={maxTotal} side="ask" onClick={() => onSelectPrice?.(l.price)} />
        ))}
      </div>

      <div
        className={cn(
          "flex items-center justify-between border-y border-border bg-muted/40 px-3 py-2 font-mono text-base font-bold tabular-nums",
          direction === "up" ? "text-success" : "text-destructive",
        )}
      >
        <span className="flex items-center gap-1">
          {formatNumber(price, 2)}
          {direction === "up" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        </span>
        <span className="text-[11px] font-normal text-muted-foreground">Último preço</span>
      </div>

      <div className="flex-1">
        {book.bids.map((l) => (
          <Row key={`b-${l.price}`} level={l} maxTotal={maxTotal} side="bid" onClick={() => onSelectPrice?.(l.price)} />
        ))}
      </div>
    </div>
  );
}
