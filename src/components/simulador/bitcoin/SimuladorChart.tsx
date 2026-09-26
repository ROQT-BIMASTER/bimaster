import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { computeMovingAverage, type Candle } from "@/lib/simulador/btcMarketEngine";
import type { Timeframe } from "@/hooks/useBtcSimulator";

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h"];

const COLOR_UP = "hsl(var(--success))";
const COLOR_DOWN = "hsl(var(--destructive))";
const COLOR_MA_FAST = "hsl(var(--warning))";
const COLOR_MA_SLOW = "hsl(var(--primary))";

interface Props {
  candles: Candle[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  price: number;
}

interface Point {
  time: number;
  label: string;
  openClose: [number, number];
  lowHigh: [number, number];
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  up: boolean;
  ma7: number | null;
  ma25: number | null;
}

interface ShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: Point;
}

function CandleBody({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
  const color = payload?.up ? COLOR_UP : COLOR_DOWN;
  const w = Math.max(2, width * 0.7);
  const cx = x + width / 2;
  const h = Math.max(1, Math.abs(height));
  return <rect x={cx - w / 2} y={y} width={w} height={h} fill={color} rx={1} />;
}

function CandleWick({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
  const color = payload?.up ? COLOR_UP : COLOR_DOWN;
  const cx = x + width / 2;
  return <rect x={cx - 0.75} y={y} width={1.5} height={Math.max(1, Math.abs(height))} fill={color} />;
}

function VolumeBar({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
  const color = payload?.up ? COLOR_UP : COLOR_DOWN;
  const w = Math.max(2, width * 0.7);
  return <rect x={x + width / 2 - w / 2} y={y} width={w} height={Math.max(0, height)} fill={color} opacity={0.25} />;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
}

function CandleTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const change = ((p.close - p.open) / p.open) * 100;
  return (
    <div className="rounded-md border border-border bg-popover/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm">
      <div className="mb-1 font-medium text-foreground">{format(p.time, "dd/MM HH:mm")}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono tabular-nums text-muted-foreground">
        <span>Abertura</span><span className="text-right text-foreground">{formatCurrency(p.open)}</span>
        <span>Máxima</span><span className="text-right text-foreground">{formatCurrency(p.high)}</span>
        <span>Mínima</span><span className="text-right text-foreground">{formatCurrency(p.low)}</span>
        <span>Fechamento</span><span className="text-right text-foreground">{formatCurrency(p.close)}</span>
        <span>Variação</span>
        <span className={cn("text-right", p.up ? "text-success" : "text-destructive")}>
          {change >= 0 ? "+" : ""}{change.toFixed(2)}%
        </span>
        <span>Volume</span><span className="text-right text-foreground">{formatNumber(p.volume, 4)} BTC</span>
      </div>
    </div>
  );
}

export function SimuladorChart({ candles, timeframe, onTimeframeChange, price }: Props) {
  const [mode, setMode] = useState<"candles" | "line">("candles");

  const data = useMemo<Point[]>(() => {
    const ma7 = computeMovingAverage(candles, 7);
    const ma25 = computeMovingAverage(candles, 25);
    const fmt = timeframe === "1h" ? "dd/MM HH'h'" : "HH:mm";
    return candles.map((c, i) => ({
      time: c.time,
      label: format(c.time, fmt),
      openClose: [c.open, c.close],
      lowHigh: [c.low, c.high],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      up: c.close >= c.open,
      ma7: ma7[i],
      ma25: ma25[i],
    }));
  }, [candles, timeframe]);

  const [yMin, yMax] = useMemo(() => {
    if (!data.length) return [0, 1];
    let min = Infinity;
    let max = -Infinity;
    for (const d of data) {
      if (d.low < min) min = d.low;
      if (d.high > max) max = d.high;
    }
    const pad = (max - min) * 0.08 || max * 0.002;
    return [min - pad, max + pad];
  }, [data]);

  const lastUp = data.length ? data[data.length - 1].up : true;

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf}
              size="sm"
              variant={tf === timeframe ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => onTimeframeChange(tf)}
            >
              {tf}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_MA_FAST }} />
            MA(7)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_MA_SLOW }} />
            MA(25)
          </span>
          <div className="ml-2 flex items-center gap-1">
            <Button
              size="sm"
              variant={mode === "candles" ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setMode("candles")}
            >
              Candles
            </Button>
            <Button
              size="sm"
              variant={mode === "line" ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setMode("line")}
            >
              Linha
            </Button>
          </div>
        </div>
      </div>

      <div className="relative min-h-[380px] flex-1 p-2">
        <div
          className={cn(
            "absolute right-3 top-3 z-10 rounded px-1.5 py-0.5 font-mono text-xs font-medium",
            lastUp ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground",
          )}
        >
          {formatCurrency(price)}
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="btcArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR_MA_SLOW} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLOR_MA_SLOW} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <XAxis dataKey="label" xAxisId="wick" hide />
            <XAxis dataKey="label" xAxisId="vol" hide />
            <YAxis
              orientation="right"
              domain={[yMin, yMax]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(v: number) => formatNumber(v, 0)}
            />
            <YAxis yAxisId="vol" orientation="left" domain={[0, (max: number) => max * 4]} hide />
            <Tooltip content={<CandleTooltip />} cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3 3" }} />

            <Bar dataKey="volume" yAxisId="vol" xAxisId="vol" shape={<VolumeBar />} isAnimationActive={false} />

            {mode === "candles" ? (
              <>
                <Bar dataKey="lowHigh" xAxisId="wick" shape={<CandleWick />} isAnimationActive={false} />
                <Bar dataKey="openClose" shape={<CandleBody />} isAnimationActive={false} />
              </>
            ) : (
              <Area
                type="monotone"
                dataKey="close"
               
                stroke={COLOR_MA_SLOW}
                strokeWidth={2}
                fill="url(#btcArea)"
                isAnimationActive={false}
              />
            )}
            <Line type="monotone" dataKey="ma7" stroke={COLOR_MA_FAST} strokeWidth={1.25} dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="ma25" stroke={COLOR_MA_SLOW} strokeWidth={1.25} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
