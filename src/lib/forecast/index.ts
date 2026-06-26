/**
 * Entry point unificado: escolhe automaticamente o método de previsão
 * com base no perfil da série.
 *
 *   zeros > 40% OU meses_ativos < 6 → Croston SBA (intermitente)
 *   n ≥ 24 e CV < 0.5              → Holt-Winters (estável c/ sazonalidade)
 *   n ≥ 12                          → Holt linear
 *   n ≥ 3                           → linear simples
 *   senão                           → "insufficient"
 */

import { forecastSeries, type ForecastResult, type ForecastMethod } from "./holtWinters";
import { crostonSBA } from "./croston";

export type { ForecastResult, ForecastPoint } from "./holtWinters";
export type ForecastMethodAll = ForecastMethod | "croston-sba";

/** Rótulo legível para UI. */
export function forecastLabel(method: ForecastMethodAll | string): string {
  switch (method) {
    case "holt-winters": return "Holt-Winters (sazonalidade)";
    case "holt": return "Holt linear";
    case "linear": return "Regressão linear";
    case "croston-sba": return "Croston-SBA (intermitente)";
    case "insufficient": return "Histórico insuficiente";
    default: return String(method);
  }
}

export function buildForecast(values: number[], horizon = 6): ForecastResult {
  const n = values.length;
  if (n < 3) {
    return { method: "insufficient", forecast: [], trend: [], residualStd: 0 };
  }

  const ativos = values.filter((v) => v > 0).length;
  const zerosRatio = 1 - ativos / n;

  // Perfil intermitente → Croston-SBA
  if (zerosRatio > 0.4 || ativos < 6) {
    return crostonSBA(values, horizon);
  }

  // Caso estável → cai no Holt-Winters / Holt / linear via forecastSeries
  return forecastSeries(values, horizon);
}

export { forecastSeries, crostonSBA };
