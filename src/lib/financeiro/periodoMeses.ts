/**
 * Geração e formatação de chaves YYYY-MM para os últimos N meses.
 * Usa America/Sao_Paulo implicitamente via Date local.
 */
export function getMesesPeriodo(ate: Date, qtdMeses: number = 6): string[] {
  const out: string[] = [];
  const d = new Date(ate.getFullYear(), ate.getMonth(), 1);
  for (let i = qtdMeses - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

const NOMES_MES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function labelMes(chave: string): string {
  const [y, m] = chave.split("-");
  return `${NOMES_MES[Number(m) - 1]}/${y.slice(2)}`;
}

export function labelMesLongo(chave: string): string {
  const [y, m] = chave.split("-");
  return `${NOMES_MES[Number(m) - 1]}/${y}`;
}
