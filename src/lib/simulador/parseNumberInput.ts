/** Aceita entrada numérica em pt-BR ("1.234,56") ou en-US ("1234.56"). */
export function parseNumberInput(raw: string): number {
  const s = raw.trim();
  if (!s) return NaN;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}
