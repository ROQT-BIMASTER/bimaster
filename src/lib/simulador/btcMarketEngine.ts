/**
 * Motor do Simulador de Investimento em Bitcoin.
 *
 * Módulo puro (sem React, sem backend): gera preços sintéticos, book de ofertas,
 * negociações de mercado e executa ordens contra uma carteira virtual.
 * Todo o dinheiro aqui é fictício — nenhuma operação real é realizada.
 */

export const SALDO_INICIAL_BRL = 10_000_000;
export const PRECO_BASE_BRL = 618_450;
export const PAR = "BTC/BRL";

/** Taxa cobrada em ordens a mercado (taker). */
export const TAXA_TAKER = 0.005;
/** Taxa cobrada em ordens limitadas executadas (maker). */
export const TAXA_MAKER = 0.0025;

export const MIN_ORDEM_BTC = 0.00001;
export const STORAGE_KEY = "btc_simulador_state_v1";

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";
export type OrderStatus = "filled" | "open" | "cancelled";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  amount: number;
  /** Acumulado de BTC até este nível (para barra de profundidade). */
  total: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPct: number;
}

export interface MarketTrade {
  id: string;
  time: number;
  price: number;
  amount: number;
  side: OrderSide;
}

export interface Order {
  id: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  /** Preço unitário (BRL por BTC). */
  price: number;
  /** Quantidade em BTC. */
  amount: number;
  /** Valor bruto em BRL (price * amount). */
  total: number;
  /** Taxa em BRL. */
  fee: number;
  createdAt: number;
  filledAt?: number;
  cancelledAt?: number;
}

export interface Portfolio {
  saldoBrl: number;
  saldoBtc: number;
  /** BRL reservado em ordens limitadas de compra abertas. */
  reservadoBrl: number;
  /** BTC reservado em ordens limitadas de venda abertas. */
  reservadoBtc: number;
  /** Preço médio de aquisição da posição atual. */
  precoMedio: number;
  /** Custo total (com taxas) da posição atual em BTC. */
  custoPosicao: number;
  /** Resultado realizado acumulado (líquido de taxas). */
  resultadoRealizado: number;
  totalTaxas: number;
}

export interface SimulatorState {
  version: 1;
  portfolio: Portfolio;
  orders: Order[];
  lastPrice: number;
  createdAt: number;
  updatedAt: number;
}

export interface Equity {
  valorBtc: number;
  patrimonio: number;
  resultadoNaoRealizado: number;
  resultadoNaoRealizadoPct: number;
  resultadoTotal: number;
  resultadoTotalPct: number;
  disponivelBrl: number;
  disponivelBtc: number;
}

export type ExecutionResult =
  | { ok: true; portfolio: Portfolio; order: Order }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Utilitários numéricos
// ---------------------------------------------------------------------------

export const roundBrl = (v: number): number => Math.round(v * 100) / 100;
export const roundBtc = (v: number): number => Math.round(v * 1e8) / 1e8;

export function formatBtc(value: number, decimals = 8): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

let idCounter = 0;
export function newId(prefix = "ord"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Gerador pseudoaleatório determinístico (mulberry32) — permite testes estáveis
// ---------------------------------------------------------------------------

export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Amostra normal padrão via Box-Muller. */
export function randomNormal(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ---------------------------------------------------------------------------
// Preço sintético
// ---------------------------------------------------------------------------

export interface PriceModelOptions {
  /** Volatilidade por passo (desvio padrão do retorno log). */
  volatility?: number;
  /** Drift por passo. */
  drift?: number;
  /** Força de reversão à média em torno de `anchor` (0 = desligado). */
  meanReversion?: number;
  anchor?: number;
}

/**
 * Próximo preço via movimento browniano geométrico com leve reversão à média,
 * para o preço não fugir para valores absurdos em sessões longas.
 */
export function nextPrice(prev: number, rng: Rng, opts: PriceModelOptions = {}): number {
  const {
    volatility = 0.0006,
    drift = 0,
    meanReversion = 0.0004,
    anchor = PRECO_BASE_BRL,
  } = opts;
  const shock = randomNormal(rng) * volatility;
  const pull = meanReversion * Math.log(anchor / prev);
  const next = prev * Math.exp(drift + pull + shock);
  return Math.max(1000, Math.round(next * 100) / 100);
}

/**
 * Gera histórico de candles terminando em `endPrice` no instante `endTime`.
 * O último candle é "fechado"; o candle ao vivo é criado pelo consumidor.
 */
export function generateHistory(
  endPrice: number,
  count: number,
  intervalMs: number,
  endTime: number,
  rng: Rng,
  volatilityPerCandle = 0.006,
): Candle[] {
  // Gera para frente a partir de um preço arbitrário e depois reescala
  // multiplicativamente para que o último fechamento seja `endPrice`.
  const raw: Candle[] = [];
  let price = endPrice;
  const alignedEnd = Math.floor(endTime / intervalMs) * intervalMs;
  for (let i = 0; i < count; i++) {
    const open = price;
    const steps = 6;
    let high = open;
    let low = open;
    let p = open;
    for (let s = 0; s < steps; s++) {
      p = nextPrice(p, rng, {
        volatility: volatilityPerCandle / Math.sqrt(steps),
        meanReversion: 0,
      });
      if (p > high) high = p;
      if (p < low) low = p;
    }
    const close = p;
    const volume = Math.abs(randomNormal(rng)) * 4 + 1.5 + (Math.abs(close - open) / open) * 900;
    raw.push({
      time: alignedEnd - (count - i) * intervalMs,
      open,
      high,
      low,
      close,
      volume: Math.round(volume * 1e4) / 1e4,
    });
    price = close;
  }
  const lastClose = raw[raw.length - 1]?.close ?? endPrice;
  const scale = endPrice / lastClose;
  return raw.map((c) => ({
    ...c,
    open: roundBrl(c.open * scale),
    high: roundBrl(c.high * scale),
    low: roundBrl(c.low * scale),
    close: roundBrl(c.close * scale),
  }));
}

/** Atualiza (ou abre) o candle ao vivo com um novo tick de preço. */
export function applyTick(
  candles: Candle[],
  price: number,
  time: number,
  intervalMs: number,
  volume: number,
  maxCandles: number,
): Candle[] {
  const bucket = Math.floor(time / intervalMs) * intervalMs;
  const last = candles[candles.length - 1];
  if (last && last.time === bucket) {
    const updated: Candle = {
      ...last,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      close: price,
      volume: roundBtc(last.volume + volume),
    };
    return [...candles.slice(0, -1), updated];
  }
  const open = last ? last.close : price;
  const fresh: Candle = {
    time: bucket,
    open,
    high: Math.max(open, price),
    low: Math.min(open, price),
    close: price,
    volume: roundBtc(volume),
  };
  const next = [...candles, fresh];
  return next.length > maxCandles ? next.slice(next.length - maxCandles) : next;
}

export function computeMovingAverage(candles: Candle[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    out.push(i >= period - 1 ? roundBrl(sum / period) : null);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Book de ofertas e negociações
// ---------------------------------------------------------------------------

export function buildOrderBook(price: number, rng: Rng, levels = 14): OrderBook {
  const halfSpread = price * (0.00012 + rng() * 0.00008);
  const bestBid = roundBrl(price - halfSpread);
  const bestAsk = roundBrl(price + halfSpread);
  const stepBase = price * 0.00018;

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];
  let bidPrice = bestBid;
  let askPrice = bestAsk;
  let bidCum = 0;
  let askCum = 0;
  for (let i = 0; i < levels; i++) {
    const bidAmount = roundBtc(0.01 + rng() * 0.6 + (i > levels * 0.6 ? rng() * 2.5 : 0));
    const askAmount = roundBtc(0.01 + rng() * 0.6 + (i > levels * 0.6 ? rng() * 2.5 : 0));
    bidCum = roundBtc(bidCum + bidAmount);
    askCum = roundBtc(askCum + askAmount);
    bids.push({ price: bidPrice, amount: bidAmount, total: bidCum });
    asks.push({ price: askPrice, amount: askAmount, total: askCum });
    bidPrice = roundBrl(bidPrice - stepBase * (0.5 + rng()));
    askPrice = roundBrl(askPrice + stepBase * (0.5 + rng()));
  }
  const spread = roundBrl(bestAsk - bestBid);
  return { bids, asks, spread, spreadPct: (spread / price) * 100 };
}

export function generateMarketTrades(price: number, time: number, rng: Rng, max = 3): MarketTrade[] {
  const n = Math.floor(rng() * (max + 1));
  const trades: MarketTrade[] = [];
  for (let i = 0; i < n; i++) {
    const side: OrderSide = rng() > 0.5 ? "buy" : "sell";
    const jitter = price * (rng() - 0.5) * 0.0003;
    const amount = roundBtc(Math.pow(rng(), 2.2) * 0.9 + 0.0004);
    trades.push({
      id: newId("trd"),
      time: time - Math.floor(rng() * 800),
      price: roundBrl(price + jitter),
      amount,
      side,
    });
  }
  return trades;
}

// ---------------------------------------------------------------------------
// Carteira e execução
// ---------------------------------------------------------------------------

export function createInitialPortfolio(saldoBrl = SALDO_INICIAL_BRL): Portfolio {
  return {
    saldoBrl,
    saldoBtc: 0,
    reservadoBrl: 0,
    reservadoBtc: 0,
    precoMedio: 0,
    custoPosicao: 0,
    resultadoRealizado: 0,
    totalTaxas: 0,
  };
}

export function createInitialState(lastPrice = PRECO_BASE_BRL, now = Date.now()): SimulatorState {
  return {
    version: 1,
    portfolio: createInitialPortfolio(),
    orders: [],
    lastPrice,
    createdAt: now,
    updatedAt: now,
  };
}

export function disponivelBrl(p: Portfolio): number {
  return roundBrl(p.saldoBrl - p.reservadoBrl);
}

export function disponivelBtc(p: Portfolio): number {
  return roundBtc(p.saldoBtc - p.reservadoBtc);
}

/** Quantidade máxima de BTC comprável com o saldo disponível a um preço. */
export function maxCompraBtc(p: Portfolio, price: number, fee = TAXA_TAKER): number {
  if (price <= 0) return 0;
  return roundBtc(Math.floor((disponivelBrl(p) / (price * (1 + fee))) * 1e8) / 1e8);
}

export function calcularCusto(amount: number, price: number, fee: number) {
  const total = roundBrl(amount * price);
  const taxa = roundBrl(total * fee);
  return { total, taxa };
}

/**
 * Aplica um preenchimento (compra ou venda) à carteira. `fromReserved` indica
 * que os fundos já estavam reservados por uma ordem limitada.
 */
function applyFill(
  p: Portfolio,
  side: OrderSide,
  amount: number,
  price: number,
  feeRate: number,
  fromReserved: boolean,
): { portfolio: Portfolio; total: number; fee: number } | { error: string } {
  const { total, taxa } = calcularCusto(amount, price, feeRate);

  if (side === "buy") {
    const custo = roundBrl(total + taxa);
    const disponivel = fromReserved ? p.saldoBrl : disponivelBrl(p);
    if (custo > disponivel + 0.005) {
      return { error: "Saldo em reais insuficiente para esta compra." };
    }
    const novoBtc = roundBtc(p.saldoBtc + amount);
    const novoCusto = roundBrl(p.custoPosicao + custo);
    return {
      portfolio: {
        ...p,
        saldoBrl: roundBrl(p.saldoBrl - custo),
        reservadoBrl: fromReserved ? roundBrl(Math.max(0, p.reservadoBrl - custo)) : p.reservadoBrl,
        saldoBtc: novoBtc,
        custoPosicao: novoCusto,
        precoMedio: novoBtc > 0 ? roundBrl(novoCusto / novoBtc) : 0,
        totalTaxas: roundBrl(p.totalTaxas + taxa),
      },
      total,
      fee: taxa,
    };
  }

  const disponivel = fromReserved ? p.saldoBtc : disponivelBtc(p);
  if (amount > disponivel + 1e-9) {
    return { error: "Saldo em BTC insuficiente para esta venda." };
  }
  const receita = roundBrl(total - taxa);
  const custoBaixado = roundBrl(p.precoMedio * amount);
  const resultado = roundBrl(receita - custoBaixado);
  const novoBtc = roundBtc(p.saldoBtc - amount);
  const zerou = novoBtc <= MIN_ORDEM_BTC / 10;
  return {
    portfolio: {
      ...p,
      saldoBrl: roundBrl(p.saldoBrl + receita),
      saldoBtc: zerou ? 0 : novoBtc,
      reservadoBtc: fromReserved ? roundBtc(Math.max(0, p.reservadoBtc - amount)) : p.reservadoBtc,
      custoPosicao: zerou ? 0 : roundBrl(Math.max(0, p.custoPosicao - custoBaixado)),
      precoMedio: zerou ? 0 : p.precoMedio,
      resultadoRealizado: roundBrl(p.resultadoRealizado + resultado),
      totalTaxas: roundBrl(p.totalTaxas + taxa),
    },
    total,
    fee: taxa,
  };
}

export function validarQuantidade(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Informe uma quantidade válida.";
  if (amount < MIN_ORDEM_BTC) return `Quantidade mínima: ${formatBtc(MIN_ORDEM_BTC, 5)} BTC.`;
  return null;
}

export function executeMarketOrder(
  p: Portfolio,
  side: OrderSide,
  amount: number,
  price: number,
  now = Date.now(),
): ExecutionResult {
  const invalid = validarQuantidade(amount);
  if (invalid) return { ok: false, error: invalid };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Preço de mercado indisponível." };

  const amt = roundBtc(amount);
  const res = applyFill(p, side, amt, price, TAXA_TAKER, false);
  if ("error" in res) return { ok: false, error: res.error };

  const order: Order = {
    id: newId(),
    side,
    type: "market",
    status: "filled",
    price,
    amount: amt,
    total: res.total,
    fee: res.fee,
    createdAt: now,
    filledAt: now,
  };
  return { ok: true, portfolio: res.portfolio, order };
}

export function placeLimitOrder(
  p: Portfolio,
  side: OrderSide,
  amount: number,
  limitPrice: number,
  now = Date.now(),
): ExecutionResult {
  const invalid = validarQuantidade(amount);
  if (invalid) return { ok: false, error: invalid };
  if (!Number.isFinite(limitPrice) || limitPrice <= 0) return { ok: false, error: "Informe um preço limite válido." };

  const amt = roundBtc(amount);
  const { total, taxa } = calcularCusto(amt, limitPrice, TAXA_MAKER);

  if (side === "buy") {
    const custo = roundBrl(total + taxa);
    if (custo > disponivelBrl(p) + 0.005) return { ok: false, error: "Saldo em reais insuficiente para reservar esta ordem." };
    const order: Order = {
      id: newId(),
      side,
      type: "limit",
      status: "open",
      price: limitPrice,
      amount: amt,
      total,
      fee: taxa,
      createdAt: now,
    };
    return {
      ok: true,
      portfolio: { ...p, reservadoBrl: roundBrl(p.reservadoBrl + custo) },
      order,
    };
  }

  if (amt > disponivelBtc(p) + 1e-9) return { ok: false, error: "Saldo em BTC insuficiente para reservar esta ordem." };
  const order: Order = {
    id: newId(),
    side,
    type: "limit",
    status: "open",
    price: limitPrice,
    amount: amt,
    total,
    fee: taxa,
    createdAt: now,
  };
  return {
    ok: true,
    portfolio: { ...p, reservadoBtc: roundBtc(p.reservadoBtc + amt) },
    order,
  };
}

export function cancelOrder(state: SimulatorState, orderId: string, now = Date.now()): SimulatorState {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order || order.status !== "open") return state;
  let portfolio = state.portfolio;
  if (order.side === "buy") {
    const custo = roundBrl(order.total + order.fee);
    portfolio = { ...portfolio, reservadoBrl: roundBrl(Math.max(0, portfolio.reservadoBrl - custo)) };
  } else {
    portfolio = { ...portfolio, reservadoBtc: roundBtc(Math.max(0, portfolio.reservadoBtc - order.amount)) };
  }
  return {
    ...state,
    portfolio,
    orders: state.orders.map((o) =>
      o.id === orderId ? { ...o, status: "cancelled", cancelledAt: now } : o,
    ),
    updatedAt: now,
  };
}

/**
 * Verifica ordens limitadas abertas contra o preço atual e executa as que
 * foram alcançadas. Retorna o novo estado e as ordens preenchidas.
 */
export function processLimitOrders(
  state: SimulatorState,
  price: number,
  now = Date.now(),
): { state: SimulatorState; filled: Order[] } {
  const filled: Order[] = [];
  let portfolio = state.portfolio;
  let changed = false;

  const orders = state.orders.map((o) => {
    if (o.status !== "open") return o;
    const hit = o.side === "buy" ? price <= o.price : price >= o.price;
    if (!hit) return o;
    const res = applyFill(portfolio, o.side, o.amount, o.price, TAXA_MAKER, true);
    if ("error" in res) {
      // Fundos deixaram de existir (não deveria ocorrer com reserva) — cancela.
      changed = true;
      return { ...o, status: "cancelled" as OrderStatus, cancelledAt: now };
    }
    portfolio = res.portfolio;
    changed = true;
    const done: Order = { ...o, status: "filled", filledAt: now, total: res.total, fee: res.fee };
    filled.push(done);
    return done;
  });

  if (!changed) return { state, filled };
  return { state: { ...state, portfolio, orders, lastPrice: price, updatedAt: now }, filled };
}

export function computeEquity(p: Portfolio, price: number): Equity {
  const valorBtc = roundBrl(p.saldoBtc * price);
  const patrimonio = roundBrl(p.saldoBrl + valorBtc);
  const naoRealizado = roundBrl(valorBtc - p.custoPosicao);
  const naoRealizadoPct = p.custoPosicao > 0 ? (naoRealizado / p.custoPosicao) * 100 : 0;
  const resultadoTotal = roundBrl(patrimonio - SALDO_INICIAL_BRL);
  return {
    valorBtc,
    patrimonio,
    resultadoNaoRealizado: naoRealizado,
    resultadoNaoRealizadoPct: naoRealizadoPct,
    resultadoTotal,
    resultadoTotalPct: (resultadoTotal / SALDO_INICIAL_BRL) * 100,
    disponivelBrl: disponivelBrl(p),
    disponivelBtc: disponivelBtc(p),
  };
}

// ---------------------------------------------------------------------------
// Persistência local (apenas conveniência do jogador; nada sensível)
// ---------------------------------------------------------------------------

export function loadState(storage: Pick<Storage, "getItem"> | undefined): SimulatorState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SimulatorState>;
    if (parsed.version !== 1 || !parsed.portfolio || !Array.isArray(parsed.orders)) return null;
    const p = parsed.portfolio;
    const nums = [p.saldoBrl, p.saldoBtc, p.reservadoBrl, p.reservadoBtc, p.precoMedio, p.custoPosicao, p.resultadoRealizado, p.totalTaxas];
    if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n))) return null;
    return {
      version: 1,
      portfolio: p,
      orders: parsed.orders as Order[],
      lastPrice: typeof parsed.lastPrice === "number" && parsed.lastPrice > 0 ? parsed.lastPrice : PRECO_BASE_BRL,
      createdAt: parsed.createdAt ?? Date.now(),
      updatedAt: parsed.updatedAt ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveState(storage: Pick<Storage, "setItem"> | undefined, state: SimulatorState): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota ou modo privado — ignora silenciosamente
  }
}

export function clearState(storage: Pick<Storage, "removeItem"> | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
}
