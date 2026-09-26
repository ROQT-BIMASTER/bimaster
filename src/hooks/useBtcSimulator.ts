import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import {
  applyTick,
  buildOrderBook,
  cancelOrder as cancelOrderEngine,
  clearState,
  computeEquity,
  createInitialState,
  createRng,
  executeMarketOrder,
  formatBtc,
  generateHistory,
  generateMarketTrades,
  loadState,
  nextPrice,
  placeLimitOrder as placeLimitOrderEngine,
  processLimitOrders,
  SALDO_INICIAL_BRL,
  saveState,
  type Candle,
  type MarketTrade,
  type Order,
  type OrderBook,
  type OrderSide,
  type SimulatorState,
} from "@/lib/simulador/btcMarketEngine";

export type Timeframe = "1m" | "5m" | "15m" | "1h";

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
};

const HISTORY_CANDLES = 90;
const MAX_CANDLES = 140;
const TICK_MS = 1000;
const MAX_TRADES = 40;

export interface Stats24h {
  variacaoAbs: number;
  variacaoPct: number;
  maxima: number;
  minima: number;
  volumeBtc: number;
  volumeBrl: number;
}

function getStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

export function useBtcSimulator() {
  const [state, setState] = useState<SimulatorState>(() => loadState(getStorage()) ?? createInitialState());
  const [price, setPrice] = useState<number>(state.lastPrice);
  const [prevPrice, setPrevPrice] = useState<number>(state.lastPrice);
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [running, setRunning] = useState(true);
  const rngRef = useRef(createRng(Date.now() % 2_147_483_647));
  const [candles, setCandles] = useState<Candle[]>(() =>
    generateHistory(state.lastPrice, HISTORY_CANDLES, TIMEFRAME_MS["1m"], Date.now(), rngRef.current),
  );
  const [orderBook, setOrderBook] = useState<OrderBook>(() => buildOrderBook(state.lastPrice, rngRef.current));
  const [trades, setTrades] = useState<MarketTrade[]>(() =>
    generateMarketTrades(state.lastPrice, Date.now(), rngRef.current, 12),
  );
  const [openPrice24h] = useState<number>(() => state.lastPrice * (1 + (rngRef.current() - 0.5) * 0.06));
  const stateRef = useRef(state);
  stateRef.current = state;
  const priceRef = useRef(state.lastPrice);
  const tickRef = useRef(0);

  // Regenera histórico ao trocar de timeframe (mantém continuidade no preço).
  const changeTimeframe = useCallback((tf: Timeframe) => {
    setTimeframe(tf);
    setCandles(generateHistory(priceRef.current, HISTORY_CANDLES, TIMEFRAME_MS[tf], Date.now(), rngRef.current));
  }, []);

  // Loop de mercado: 1 tick por segundo.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const rng = rngRef.current;
      const now = Date.now();
      const prev = priceRef.current;
      const next = nextPrice(prev, rng);
      priceRef.current = next;
      tickRef.current += 1;

      const newTrades = generateMarketTrades(next, now, rng);
      const tickVolume = newTrades.reduce((s, t) => s + t.amount, 0);

      setPrevPrice(prev);
      setPrice(next);
      setCandles((cs) => applyTick(cs, next, now, TIMEFRAME_MS[timeframe], tickVolume, MAX_CANDLES));
      if (newTrades.length) setTrades((ts) => [...newTrades, ...ts].slice(0, MAX_TRADES));
      setOrderBook(buildOrderBook(next, rng));

      // Ordens limitadas + persistência periódica do último preço
      const current = stateRef.current;
      const { state: processed, filled } = processLimitOrders(current, next, now);
      if (processed !== current) {
        stateRef.current = processed;
        setState(processed);
      } else if (tickRef.current % 10 === 0) {
        const withPrice = { ...current, lastPrice: next };
        stateRef.current = withPrice;
        setState(withPrice);
      }
      filled.forEach((o) => {
        toast.success(`Ordem limitada ${o.side === "buy" ? "de compra" : "de venda"} executada`, {
          description: `${formatBtc(o.amount)} BTC a ${formatCurrency(o.price)}`,
        });
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, timeframe]);

  // Persistência (debounce simples via efeito).
  useEffect(() => {
    saveState(getStorage(), state);
  }, [state]);

  const buyMarket = useCallback((amount: number): boolean => {
    const res = executeMarketOrder(stateRef.current.portfolio, "buy", amount, orderBook.asks[0]?.price ?? price);
    if (res.ok === false) {
      toast.error(res.error);
      return false;
    }
    const nextState: SimulatorState = {
      ...stateRef.current,
      portfolio: res.portfolio,
      orders: [res.order, ...stateRef.current.orders],
      updatedAt: Date.now(),
    };
    stateRef.current = nextState;
    setState(nextState);
    toast.success("Compra executada", {
      description: `${formatBtc(res.order.amount)} BTC por ${formatCurrency(res.order.total + res.order.fee)}`,
    });
    return true;
  }, [orderBook, price]);

  const sellMarket = useCallback((amount: number): boolean => {
    const res = executeMarketOrder(stateRef.current.portfolio, "sell", amount, orderBook.bids[0]?.price ?? price);
    if (res.ok === false) {
      toast.error(res.error);
      return false;
    }
    const nextState: SimulatorState = {
      ...stateRef.current,
      portfolio: res.portfolio,
      orders: [res.order, ...stateRef.current.orders],
      updatedAt: Date.now(),
    };
    stateRef.current = nextState;
    setState(nextState);
    toast.success("Venda executada", {
      description: `${formatBtc(res.order.amount)} BTC por ${formatCurrency(res.order.total - res.order.fee)}`,
    });
    return true;
  }, [orderBook, price]);

  const placeLimit = useCallback((side: OrderSide, amount: number, limitPrice: number): boolean => {
    const res = placeLimitOrderEngine(stateRef.current.portfolio, side, amount, limitPrice);
    if (res.ok === false) {
      toast.error(res.error);
      return false;
    }
    const nextState: SimulatorState = {
      ...stateRef.current,
      portfolio: res.portfolio,
      orders: [res.order, ...stateRef.current.orders],
      updatedAt: Date.now(),
    };
    stateRef.current = nextState;
    setState(nextState);
    toast.success("Ordem limitada registrada", {
      description: `${side === "buy" ? "Compra" : "Venda"} de ${formatBtc(res.order.amount)} BTC a ${formatCurrency(limitPrice)}`,
    });
    return true;
  }, []);

  const cancelOrder = useCallback((orderId: string) => {
    const nextState = cancelOrderEngine(stateRef.current, orderId);
    stateRef.current = nextState;
    setState(nextState);
    toast.info("Ordem cancelada");
  }, []);

  const reset = useCallback(() => {
    clearState(getStorage());
    const fresh = createInitialState(priceRef.current);
    stateRef.current = fresh;
    setState(fresh);
    toast.success("Simulação reiniciada", { description: `Saldo restaurado para ${formatCurrency(SALDO_INICIAL_BRL)}.` });
  }, []);

  const equity = useMemo(() => computeEquity(state.portfolio, price), [state.portfolio, price]);

  const stats24h = useMemo<Stats24h>(() => {
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumeBtc = candles.reduce((s, c) => s + c.volume, 0) * 6.4;
    return {
      variacaoAbs: price - openPrice24h,
      variacaoPct: ((price - openPrice24h) / openPrice24h) * 100,
      maxima: Math.max(...highs, price, openPrice24h * 1.012),
      minima: Math.min(...lows, price, openPrice24h * 0.988),
      volumeBtc,
      volumeBrl: volumeBtc * price,
    };
  }, [candles, price, openPrice24h]);

  const openOrders = useMemo(() => state.orders.filter((o) => o.status === "open"), [state.orders]);
  const history = useMemo(() => state.orders.filter((o) => o.status !== "open"), [state.orders]);

  return {
    price,
    prevPrice,
    direction: price >= prevPrice ? ("up" as const) : ("down" as const),
    candles,
    orderBook,
    trades,
    timeframe,
    changeTimeframe,
    running,
    setRunning,
    portfolio: state.portfolio,
    equity,
    stats24h,
    orders: state.orders as Order[],
    openOrders,
    history,
    buyMarket,
    sellMarket,
    placeLimit,
    cancelOrder,
    reset,
  };
}

export type BtcSimulator = ReturnType<typeof useBtcSimulator>;
