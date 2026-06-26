/**
 * Previsão de séries temporais mensais.
 *
 * Estratégia em camadas (degradê automático conforme tamanho do histórico):
 *   n ≥ 24 → Holt-Winters aditivo (nível + tendência + sazonalidade 12m)
 *   n ≥ 12 → Holt linear (nível + tendência)
 *   n ≥ 3  → regressão linear simples
 *   n < 3  → sem projeção (insuficiente)
 *
 * Banda de confiança (95%):
 *   hi/lo = ŷ ± 1.96 · residualStd · √passo   (alarga com o horizonte)
 *   lo é clamped em 0 — vendas/quantidades não podem ser negativas.
 */

export type ForecastMethod = "holt-winters" | "holt" | "linear" | "insufficient" | "croston-sba";

export interface ForecastPoint {
  /** valor previsto */
  yhat: number;
  /** limite inferior do intervalo de 95% (≥ 0) */
  lo: number;
  /** limite superior do intervalo de 95% */
  hi: number;
}

export interface ForecastResult {
  method: ForecastMethod;
  /** previsões para os próximos `horizon` passos */
  forecast: ForecastPoint[];
  /** linha de tendência (ajuste linear) cobrindo histórico + horizonte */
  trend: number[];
  /** desvio-padrão dos resíduos in-sample (0 quando não aplicável) */
  residualStd: number;
}

const Z95 = 1.96;

function clampLo(v: number): number {
  return v < 0 ? 0 : v;
}

function residualStdDev(actual: number[], fitted: number[], dof: number): number {
  const n = Math.min(actual.length, fitted.length);
  if (n <= dof) return 0;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const e = actual[i] - fitted[i];
    sse += e * e;
  }
  return Math.sqrt(sse / (n - dof));
}

function buildBand(yhat: number[], residualStd: number): ForecastPoint[] {
  return yhat.map((v, i) => {
    const step = i + 1;
    const margin = Z95 * residualStd * Math.sqrt(step);
    return {
      yhat: v,
      lo: clampLo(v - margin),
      hi: v + margin,
    };
  });
}

/* ----------------- Regressão linear simples ----------------- */

function linearFit(y: number[]): { a: number; b: number; fitted: number[] } {
  const n = y.length;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    sx += x;
    sy += y[i];
    sxy += x * y[i];
    sxx += x * x;
  }
  const denom = n * sxx - sx * sx || 1;
  const b = (n * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / n;
  const fitted = y.map((_, i) => a + b * i);
  return { a, b, fitted };
}

function forecastLinear(y: number[], horizon: number): ForecastResult {
  const { a, b, fitted } = linearFit(y);
  const residualStd = residualStdDev(y, fitted, 2);
  const yhat: number[] = [];
  const n = y.length;
  for (let h = 1; h <= horizon; h++) {
    yhat.push(clampLo(a + b * (n - 1 + h)));
  }
  // trend across history + horizon
  const total = n + horizon;
  const trend: number[] = [];
  for (let i = 0; i < total; i++) trend.push(a + b * i);
  return {
    method: "linear",
    forecast: buildBand(yhat, residualStd),
    trend,
    residualStd,
  };
}

/* ----------------- Holt linear ----------------- */

function holtFit(y: number[], alpha: number, beta: number) {
  const n = y.length;
  let level = y[0];
  let trend = y[1] - y[0];
  const fitted: number[] = [level + trend];
  for (let t = 1; t < n; t++) {
    const prevLevel = level;
    level = alpha * y[t] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    fitted.push(level + trend);
  }
  return { level, trend, fitted };
}

function forecastHolt(y: number[], horizon: number): ForecastResult {
  let best = { sse: Infinity, alpha: 0.3, beta: 0.1 };
  const grid = [0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9];
  for (const a of grid) {
    for (const b of grid) {
      const { fitted } = holtFit(y, a, b);
      let sse = 0;
      for (let i = 1; i < y.length; i++) {
        const e = y[i] - fitted[i - 1];
        sse += e * e;
      }
      if (sse < best.sse) best = { sse, alpha: a, beta: b };
    }
  }
  const { level, trend, fitted } = holtFit(y, best.alpha, best.beta);
  const residualStd = residualStdDev(y.slice(1), fitted.slice(0, y.length - 1), 2);
  const yhat: number[] = [];
  for (let h = 1; h <= horizon; h++) yhat.push(clampLo(level + h * trend));
  const linear = linearFit(y);
  const total = y.length + horizon;
  const trendLine: number[] = [];
  for (let i = 0; i < total; i++) trendLine.push(linear.a + linear.b * i);
  return {
    method: "holt",
    forecast: buildBand(yhat, residualStd),
    trend: trendLine,
    residualStd,
  };
}

/* ----------------- Holt-Winters aditivo (sazonalidade 12) ----------------- */

function holtWintersFit(y: number[], alpha: number, beta: number, gamma: number, m = 12) {
  const n = y.length;
  // initial level = média do primeiro ciclo
  let level = 0;
  for (let i = 0; i < m; i++) level += y[i];
  level /= m;
  // initial trend = (avg second cycle - avg first cycle)/m
  let secondAvg = 0;
  for (let i = m; i < 2 * m; i++) secondAvg += y[i];
  secondAvg /= m;
  let trend = (secondAvg - level) / m;
  // initial seasonal indices = y - level no primeiro ciclo
  const season: number[] = new Array(n + m).fill(0);
  for (let i = 0; i < m; i++) season[i] = y[i] - level;

  const fitted: number[] = new Array(n).fill(0);
  for (let t = 0; t < n; t++) {
    const prevLevel = level;
    const s = season[t];
    level = alpha * (y[t] - s) + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    season[t + m] = gamma * (y[t] - level) + (1 - gamma) * s;
    fitted[t] = prevLevel + trend + s;
  }
  return { level, trend, season, fitted };
}

function forecastHoltWinters(y: number[], horizon: number, m = 12): ForecastResult {
  let best = { sse: Infinity, alpha: 0.3, beta: 0.1, gamma: 0.1 };
  const grid = [0.1, 0.3, 0.5, 0.7];
  for (const a of grid) {
    for (const b of grid) {
      for (const g of grid) {
        const { fitted } = holtWintersFit(y, a, b, g, m);
        let sse = 0;
        for (let i = m; i < y.length; i++) {
          const e = y[i] - fitted[i];
          sse += e * e;
        }
        if (sse < best.sse) best = { sse, alpha: a, beta: b, gamma: g };
      }
    }
  }
  const { level, trend, season, fitted } = holtWintersFit(y, best.alpha, best.beta, best.gamma, m);
  const residualStd = residualStdDev(y.slice(m), fitted.slice(m), 3);
  const yhat: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const s = season[y.length + h - 1] ?? 0;
    yhat.push(clampLo(level + h * trend + s));
  }
  const linear = linearFit(y);
  const total = y.length + horizon;
  const trendLine: number[] = [];
  for (let i = 0; i < total; i++) trendLine.push(linear.a + linear.b * i);
  return {
    method: "holt-winters",
    forecast: buildBand(yhat, residualStd),
    trend: trendLine,
    residualStd,
  };
}

/* ----------------- API pública ----------------- */

export function forecastSeries(values: number[], horizon = 6): ForecastResult {
  const n = values.length;
  if (n < 3) {
    return { method: "insufficient", forecast: [], trend: [], residualStd: 0 };
  }
  if (n >= 24) return forecastHoltWinters(values, horizon);
  if (n >= 12) return forecastHolt(values, horizon);
  return forecastLinear(values, horizon);
}
