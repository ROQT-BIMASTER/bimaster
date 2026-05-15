/**
 * Helper canônico para ler o "Custo Total" gravado em
 * `fabrica_ficha_custo_revisoes.snapshot_totais` garantindo que o IPI Saída
 * esteja incluído na leitura — independentemente de o snapshot ter sido
 * gerado antes ou depois do PR de IPI ponta-a-ponta.
 *
 * Convenção:
 * - Snapshots novos gravam `ipi_incluido: true` quando `custoTotal` já
 *   contém o IPI Saída (Kit embutido + IPI sobre baseNF+markupNF).
 * - Snapshots legados não têm a flag. Nesse caso o helper soma o IPI
 *   conhecido (preferindo `totalIPI` persistido; caindo para um cálculo
 *   sobre `totalNF + markupNF * ipi_percentual_saida` quando `totalIPI`
 *   estiver zerado mas houver percentual).
 *
 * Use sempre este helper para exibir o custo total da ficha. Não leia
 * `snapshot_totais.custoTotal` diretamente em UI.
 */
export type FichaSnapshotTotais = {
  custoTotal?: number | string | null;
  custoFinalTotal?: number | string | null;
  totalNF?: number | string | null;
  totalServico?: number | string | null;
  totalCondicao?: number | string | null;
  markupNF?: number | string | null;
  markupServico?: number | string | null;
  markupCondicao?: number | string | null;
  totalIPI?: number | string | null;
  ipi_percentual_saida?: number | string | null;
  ipi_incluido?: boolean | null;
  [key: string]: unknown;
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Retorna o custo total da ficha COM IPI Saída incluso.
 * Aceita o objeto bruto vindo de `snapshot_totais` (string ou objeto).
 */
export function custoTotalDoSnapshot(snap: FichaSnapshotTotais | string | null | undefined): number {
  if (snap == null) return 0;
  const obj: FichaSnapshotTotais = typeof snap === "string"
    ? (() => { try { return JSON.parse(snap); } catch { return {}; } })()
    : snap;

  const base = num(obj.custoTotal ?? obj.custoFinalTotal);

  // Snapshots novos já trazem IPI dentro do custoTotal.
  if (obj.ipi_incluido === true) return base;

  // Snapshots legados: somar o IPI conhecido sem double-count.
  const ipiPersistido = num(obj.totalIPI);
  if (ipiPersistido > 0) return base + ipiPersistido;

  const pctSaida = num(obj.ipi_percentual_saida);
  if (pctSaida > 0) {
    const baseIPI = num(obj.totalNF) + num(obj.markupNF);
    if (baseIPI > 0) return base + baseIPI * (pctSaida / 100);
  }

  return base;
}

/**
 * Retorna apenas o componente de IPI Saída embutido (ou inferido) no snapshot.
 * Útil para exibir lado-a-lado com o subtotal sem IPI.
 */
export function ipiDoSnapshot(snap: FichaSnapshotTotais | string | null | undefined): number {
  if (snap == null) return 0;
  const obj: FichaSnapshotTotais = typeof snap === "string"
    ? (() => { try { return JSON.parse(snap); } catch { return {}; } })()
    : snap;

  const ipiPersistido = num(obj.totalIPI);
  if (ipiPersistido > 0) return ipiPersistido;

  const pctSaida = num(obj.ipi_percentual_saida);
  if (pctSaida > 0) {
    const baseIPI = num(obj.totalNF) + num(obj.markupNF);
    if (baseIPI > 0) return baseIPI * (pctSaida / 100);
  }
  return 0;
}
