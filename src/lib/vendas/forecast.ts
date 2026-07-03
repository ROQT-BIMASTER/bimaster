// Projeção estatística simples: regressão linear (least squares) sobre os
// últimos N pontos do histórico. Retorna projeção para os próximos meses e
// banda ±1σ dos resíduos. Não substitui orçamento comercial.

export interface ForecastPonto {
  mes: string;              // YYYY-MM-01
  historico: number | null; // valor real (null nos meses projetados)
  projecao: number | null;  // valor projetado (null nos meses reais)
  bandaMin: number | null;
  bandaMax: number | null;
}

interface Options {
  janela?: number;    // meses do histórico usados no fit (default 12)
  horizonte?: number; // meses a projetar (default 6)
}

function addMonths(iso: string, delta: number): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m - 1) + delta, 1));
  return d.toISOString().slice(0, 10);
}

export function buildForecast(
  serie: Array<{ mes: string; faturamento: number }>,
  opts: Options = {},
): { pontos: ForecastPonto[]; suficiente: boolean } {
  const janela = opts.janela ?? 12;
  const horizonte = opts.horizonte ?? 6;

  const historicoAll = [...serie].sort((a, b) => a.mes.localeCompare(b.mes));

  if (historicoAll.length < 6) {
    return {
      pontos: historicoAll.map((p) => ({
        mes: p.mes, historico: p.faturamento, projecao: null, bandaMin: null, bandaMax: null,
      })),
      suficiente: false,
    };
  }

  const fit = historicoAll.slice(-janela);
  const n = fit.length;
  const xs = fit.map((_, i) => i);
  const ys = fit.map((p) => p.faturamento);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  // resíduos e desvio padrão
  let ssr = 0;
  for (let i = 0; i < n; i++) {
    const yhat = intercept + slope * xs[i];
    ssr += (ys[i] - yhat) ** 2;
  }
  const sigma = Math.sqrt(ssr / Math.max(1, n - 2));

  const pontos: ForecastPonto[] = historicoAll.map((p) => ({
    mes: p.mes, historico: p.faturamento, projecao: null, bandaMin: null, bandaMax: null,
  }));

  const ultimoMes = historicoAll[historicoAll.length - 1].mes;
  const ultimoX = xs[n - 1];
  for (let k = 1; k <= horizonte; k++) {
    const x = ultimoX + k;
    const yhat = Math.max(0, intercept + slope * x);
    const mes = addMonths(ultimoMes, k);
    pontos.push({
      mes,
      historico: null,
      projecao: yhat,
      bandaMin: Math.max(0, yhat - sigma),
      bandaMax: yhat + sigma,
    });
  }

  // linkar último histórico à primeira projeção para linha contínua visual
  const idxUltimoHist = pontos.findIndex((p) => p.mes === ultimoMes);
  if (idxUltimoHist >= 0) {
    pontos[idxUltimoHist].projecao = pontos[idxUltimoHist].historico;
  }

  return { pontos, suficiente: true };
}
