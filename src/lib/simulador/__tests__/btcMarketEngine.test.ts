import { describe, expect, it } from "vitest";
import {
  SALDO_INICIAL_BRL,
  TAXA_MAKER,
  TAXA_TAKER,
  applyTick,
  buildOrderBook,
  cancelOrder,
  computeEquity,
  computeMovingAverage,
  createInitialPortfolio,
  createInitialState,
  createRng,
  executeMarketOrder,
  generateHistory,
  loadState,
  maxCompraBtc,
  nextPrice,
  placeLimitOrder,
  processLimitOrders,
  saveState,
} from "../btcMarketEngine";

describe("btcMarketEngine — preço sintético", () => {
  it("gera preços positivos e determinísticos para a mesma semente", () => {
    const a = createRng(42);
    const b = createRng(42);
    let pa = 600_000;
    let pb = 600_000;
    for (let i = 0; i < 200; i++) {
      pa = nextPrice(pa, a);
      pb = nextPrice(pb, b);
      expect(pa).toBeGreaterThan(0);
    }
    expect(pa).toBe(pb);
  });

  it("histórico termina no preço final e tem candles coerentes", () => {
    const rng = createRng(7);
    const end = 618_450;
    const candles = generateHistory(end, 60, 60_000, 1_700_000_000_000, rng);
    expect(candles).toHaveLength(60);
    expect(candles[candles.length - 1].close).toBeCloseTo(end, 2);
    for (const c of candles) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close));
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close));
      expect(c.volume).toBeGreaterThan(0);
    }
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i].time - candles[i - 1].time).toBe(60_000);
    }
  });

  it("applyTick atualiza o candle corrente e abre um novo ao mudar de bucket", () => {
    const base = 1_700_000_000_000;
    let candles = generateHistory(100_000, 3, 60_000, base, createRng(1));
    const lastTime = candles[candles.length - 1].time;
    candles = applyTick(candles, 100_500, lastTime + 10_000, 60_000, 0.1, 10);
    expect(candles).toHaveLength(3);
    expect(candles[2].close).toBe(100_500);
    expect(candles[2].high).toBeGreaterThanOrEqual(100_500);
    candles = applyTick(candles, 99_000, lastTime + 61_000, 60_000, 0.2, 10);
    expect(candles).toHaveLength(4);
    expect(candles[3].open).toBe(100_500);
    expect(candles[3].close).toBe(99_000);
  });

  it("média móvel respeita o período", () => {
    const candles = Array.from({ length: 5 }, (_, i) => ({
      time: i, open: 1, high: 1, low: 1, close: (i + 1) * 10, volume: 1,
    }));
    expect(computeMovingAverage(candles, 3)).toEqual([null, null, 20, 30, 40]);
  });

  it("book de ofertas tem bids abaixo e asks acima do preço, com acumulado crescente", () => {
    const book = buildOrderBook(600_000, createRng(3));
    expect(book.bids[0].price).toBeLessThan(600_000);
    expect(book.asks[0].price).toBeGreaterThan(600_000);
    expect(book.spread).toBeGreaterThan(0);
    for (let i = 1; i < book.bids.length; i++) {
      expect(book.bids[i].price).toBeLessThan(book.bids[i - 1].price);
      expect(book.bids[i].total).toBeGreaterThan(book.bids[i - 1].total);
      expect(book.asks[i].price).toBeGreaterThan(book.asks[i - 1].price);
    }
  });
});

describe("btcMarketEngine — carteira e ordens", () => {
  it("começa com 10 milhões em reais e sem BTC", () => {
    const p = createInitialPortfolio();
    expect(p.saldoBrl).toBe(10_000_000);
    expect(SALDO_INICIAL_BRL).toBe(10_000_000);
    expect(p.saldoBtc).toBe(0);
  });

  it("compra a mercado debita total + taxa e calcula preço médio", () => {
    const p = createInitialPortfolio();
    const res = executeMarketOrder(p, "buy", 1, 600_000, 1000);
    expect(res.ok).toBe(true);
    if (res.ok === false) return;
    expect(res.order.total).toBe(600_000);
    expect(res.order.fee).toBeCloseTo(600_000 * TAXA_TAKER, 2);
    expect(res.portfolio.saldoBrl).toBeCloseTo(10_000_000 - 603_000, 2);
    expect(res.portfolio.saldoBtc).toBe(1);
    expect(res.portfolio.precoMedio).toBeCloseTo(603_000, 2);
  });

  it("recusa compra acima do saldo e venda acima da posição", () => {
    const p = createInitialPortfolio();
    const tooMuch = executeMarketOrder(p, "buy", 100, 600_000);
    expect(tooMuch.ok).toBe(false);
    const noBtc = executeMarketOrder(p, "sell", 0.1, 600_000);
    expect(noBtc.ok).toBe(false);
    const zero = executeMarketOrder(p, "buy", 0, 600_000);
    expect(zero.ok).toBe(false);
  });

  it("maxCompraBtc cabe no saldo disponível considerando a taxa", () => {
    const p = createInitialPortfolio();
    const max = maxCompraBtc(p, 600_000);
    const res = executeMarketOrder(p, "buy", max, 600_000);
    expect(res.ok).toBe(true);
    if (res.ok === false) return;
    expect(res.portfolio.saldoBrl).toBeGreaterThanOrEqual(0);
    expect(res.portfolio.saldoBrl).toBeLessThan(600_000 * (1 + TAXA_TAKER) * 1e-8 + 1);
  });

  it("venda realiza lucro líquido de taxas e zera a posição", () => {
    const p0 = createInitialPortfolio();
    const buy = executeMarketOrder(p0, "buy", 2, 500_000);
    expect(buy.ok).toBe(true);
    if (buy.ok === false) return;
    const sell = executeMarketOrder(buy.portfolio, "sell", 2, 550_000);
    expect(sell.ok).toBe(true);
    if (sell.ok === false) return;
    const p = sell.portfolio;
    expect(p.saldoBtc).toBe(0);
    expect(p.precoMedio).toBe(0);
    // custo: 1.000.000 + 5.000 taxa; receita: 1.100.000 - 5.500 taxa
    expect(p.resultadoRealizado).toBeCloseTo(1_094_500 - 1_005_000, 2);
    expect(p.saldoBrl).toBeCloseTo(10_000_000 - 1_005_000 + 1_094_500, 2);
    expect(p.totalTaxas).toBeCloseTo(10_500, 2);
  });

  it("ordem limitada de compra reserva saldo, executa quando o preço cai e libera ao cancelar", () => {
    let state = createInitialState(600_000, 1000);
    const placed = placeLimitOrder(state.portfolio, "buy", 1, 590_000, 1000);
    expect(placed.ok).toBe(true);
    if (placed.ok === false) return;
    state = { ...state, portfolio: placed.portfolio, orders: [placed.order] };
    const reservado = 590_000 * (1 + TAXA_MAKER);
    expect(state.portfolio.reservadoBrl).toBeCloseTo(reservado, 2);
    expect(computeEquity(state.portfolio, 600_000).disponivelBrl).toBeCloseTo(10_000_000 - reservado, 2);

    // Preço acima do limite: nada acontece
    const untouched = processLimitOrders(state, 595_000, 2000);
    expect(untouched.filled).toHaveLength(0);
    expect(untouched.state).toBe(state);

    // Preço atinge o limite: executa ao preço limite com taxa maker
    const hit = processLimitOrders(state, 589_000, 3000);
    expect(hit.filled).toHaveLength(1);
    expect(hit.state.portfolio.saldoBtc).toBe(1);
    expect(hit.state.portfolio.reservadoBrl).toBeCloseTo(0, 2);
    expect(hit.state.portfolio.saldoBrl).toBeCloseTo(10_000_000 - reservado, 2);
    expect(hit.state.orders[0].status).toBe("filled");

    // Cancelamento libera a reserva
    const cancelled = cancelOrder(state, placed.order.id, 4000);
    expect(cancelled.portfolio.reservadoBrl).toBeCloseTo(0, 2);
    expect(cancelled.orders[0].status).toBe("cancelled");
  });

  it("ordem limitada de venda reserva BTC e executa quando o preço sobe", () => {
    const buy = executeMarketOrder(createInitialPortfolio(), "buy", 1, 600_000);
    expect(buy.ok).toBe(true);
    if (buy.ok === false) return;
    let state = { ...createInitialState(600_000, 1), portfolio: buy.portfolio, orders: [buy.order] };
    const placed = placeLimitOrder(state.portfolio, "sell", 1, 650_000);
    expect(placed.ok).toBe(true);
    if (placed.ok === false) return;
    state = { ...state, portfolio: placed.portfolio, orders: [placed.order, ...state.orders] };
    expect(computeEquity(state.portfolio, 600_000).disponivelBtc).toBe(0);
    // Não pode vender de novo o que já está reservado
    expect(executeMarketOrder(state.portfolio, "sell", 0.5, 600_000).ok).toBe(false);

    const hit = processLimitOrders(state, 651_000);
    expect(hit.filled).toHaveLength(1);
    expect(hit.state.portfolio.saldoBtc).toBe(0);
    expect(hit.state.portfolio.reservadoBtc).toBe(0);
    expect(hit.state.portfolio.resultadoRealizado).toBeGreaterThan(0);
  });

  it("computeEquity soma reais e BTC a mercado", () => {
    const buy = executeMarketOrder(createInitialPortfolio(), "buy", 1, 600_000);
    if (!buy.ok) throw new Error("compra deveria funcionar");
    const eq = computeEquity(buy.portfolio, 660_000);
    expect(eq.valorBtc).toBe(660_000);
    expect(eq.patrimonio).toBeCloseTo(10_000_000 - 603_000 + 660_000, 2);
    expect(eq.resultadoNaoRealizado).toBeCloseTo(660_000 - 603_000, 2);
    expect(eq.resultadoTotal).toBeCloseTo(57_000, 2);
  });
});

describe("btcMarketEngine — persistência", () => {
  function memoryStorage() {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => { m.set(k, v); },
      removeItem: (k: string) => { m.delete(k); },
    };
  }

  it("salva e recarrega o estado", () => {
    const storage = memoryStorage();
    const state = createInitialState(612_000, 5);
    saveState(storage, state);
    const loaded = loadState(storage);
    expect(loaded).not.toBeNull();
    expect(loaded?.lastPrice).toBe(612_000);
    expect(loaded?.portfolio.saldoBrl).toBe(10_000_000);
  });

  it("ignora conteúdo inválido", () => {
    const storage = memoryStorage();
    storage.setItem("btc_simulador_state_v1", "{nope");
    expect(loadState(storage)).toBeNull();
    storage.setItem("btc_simulador_state_v1", JSON.stringify({ version: 1, portfolio: { saldoBrl: "x" }, orders: [] }));
    expect(loadState(storage)).toBeNull();
  });
});
