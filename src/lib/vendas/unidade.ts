export type Unidade = "DZ" | "UN" | "CX";

export const UNIDADE_LABEL: Record<Unidade, string> = {
  DZ: "Dúzias",
  UN: "Unidades",
  CX: "Caixas",
};

export const UNIDADE_SUFIXO: Record<Unidade, string> = {
  DZ: "dz",
  UN: "un",
  CX: "cx",
};

const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const fmtDec = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * Converte quantidade canônica (em unidades) para a unidade escolhida.
 * Retorna null quando a conversão não é aplicável (ex.: CX sem itens_caixa).
 */
export function convertQtd(
  qtdUn: number | null | undefined,
  unidade: Unidade,
  itensCaixa?: number | null,
): number | null {
  if (qtdUn == null) return null;
  if (unidade === "UN") return qtdUn;
  if (unidade === "DZ") return qtdUn / 12;
  if (unidade === "CX") {
    if (!itensCaixa || itensCaixa <= 0) return null;
    return qtdUn / itensCaixa;
  }
  return qtdUn;
}

export function formatQtd(
  qtdUn: number | null | undefined,
  unidade: Unidade,
  itensCaixa?: number | null,
): string {
  const v = convertQtd(qtdUn, unidade, itensCaixa);
  if (v == null) return "—";
  const f = unidade === "DZ" || unidade === "CX" ? fmtDec : fmt;
  return `${f.format(v)} ${UNIDADE_SUFIXO[unidade]}`;
}

/** Em agregados multi-produto, CX não tem fator único — desabilita o botão. */
export const CX_INDISPONIVEL_AGGREGADO =
  "Caixas só faz sentido por produto (cada item tem fator próprio).";
