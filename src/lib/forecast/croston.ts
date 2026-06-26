/**
 * Croston / Syntetos-Boylan (SBA) para demanda intermitente.
 *
 * Croston decompõe a série em:
 *   - tamanho médio das demandas (z): EWMA dos valores > 0
 *   - intervalo médio entre demandas (p): EWMA da distância em períodos
 *
 * Previsão constante: ŷ = z / p
 * SBA corrige o viés de alta multiplicando por (1 - α/2).
 *
 * Boa para itens com muitos meses zerados (intermitentes/lumpy).
 */

import type { ForecastPoint, ForecastResult } from "./holtWinters";

const Z95 = 1.96;

function clampLo(v: number): number {
  return v < 0 ? 0 : v;
}

export function crostonSBA(
  values: number[],
  horizon = 6,
  alpha = 0.1,
): ForecastResult {
  const n = values.length;
  if (n < 3 || values.every((v) => v <= 0)) {
    return { method: "insufficient", forecast: [], trend: [], residualStd: 0 };
  }

  // Inicializa com a primeira demanda > 0
  let firstIdx = values.findIndex((v) => v > 0);
  if (firstIdx === -1) {
    return { method: "insufficient", forecast: [], trend: [], residualStd: 0 };
  }

  let z = values[firstIdx];
  let p = 1; // intervalo (em períodos) — começa em 1
  let q = 1; // contador de períodos desde a última demanda
  const fitted: number[] = new Array(n).fill(0);
  const ratio = z / p;
  for (let i = 0; i <= firstIdx; i++) fitted[i] = ratio;

  for (let i = firstIdx + 1; i < n; i++) {
    if (values[i] > 0) {
      z = alpha * values[i] + (1 - alpha) * z;
      p = alpha * q + (1 - alpha) * p;
      q = 1;
    } else {
      q += 1;
    }
    fitted[i] = z / p;
  }

  // SBA: corrige viés
  const yhatConst = (z / p) * (1 - alpha / 2);

  // Resíduos in-sample
  let sse = 0;
  let dof = 0;
  for (let i = firstIdx; i < n; i++) {
    const e = values[i] - fitted[i];
    sse += e * e;
    dof += 1;
  }
  const residualStd = dof > 1 ? Math.sqrt(sse / (dof - 1)) : 0;

  const forecast: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const band = Z95 * residualStd * Math.sqrt(h);
    forecast.push({
      yhat: clampLo(yhatConst),
      lo: clampLo(yhatConst - band),
      hi: yhatConst + band,
    });
  }

  // Tendência (linha plana na média prevista)
  const trend = new Array(n + horizon).fill(yhatConst);

  return { method: "croston-sba", forecast, trend, residualStd };
}
