import { ArrowDownRight, ArrowUpRight, Bitcoin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { PAR } from "@/lib/simulador/btcMarketEngine";
import type { Stats24h } from "@/hooks/useBtcSimulator";

interface Props {
  price: number;
  direction: "up" | "down";
  stats: Stats24h;
}

export function SimuladorPriceHeader({ price, direction, stats }: Props) {
  const positive = stats.variacaoPct >= 0;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Bitcoin className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold tracking-tight">{PAR}</span>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase tracking-wide">Simulação</Badge>
            </div>
            <span className="text-xs text-muted-foreground">Bitcoin</span>
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono text-2xl font-bold tabular-nums transition-colors",
              direction === "up" ? "text-success" : "text-destructive",
            )}
          >
            {formatCurrency(price)}
          </span>
          {direction === "up" ? (
            <ArrowUpRight className="h-5 w-5 text-success" />
          ) : (
            <ArrowDownRight className="h-5 w-5 text-destructive" />
          )}
        </div>

        <Stat
          label="Variação 24h"
          value={`${positive ? "+" : ""}${formatCurrency(stats.variacaoAbs)}  ${positive ? "+" : ""}${stats.variacaoPct.toFixed(2)}%`}
          tone={positive ? "up" : "down"}
        />
        <Stat label="Máxima 24h" value={formatCurrency(stats.maxima)} />
        <Stat label="Mínima 24h" value={formatCurrency(stats.minima)} />
        <Stat label="Volume 24h (BTC)" value={formatNumber(stats.volumeBtc, 2)} />
        <Stat label="Volume 24h (BRL)" value={formatCurrency(stats.volumeBrl, false)} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-sm font-medium tabular-nums",
          tone === "up" && "text-success",
          tone === "down" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}
