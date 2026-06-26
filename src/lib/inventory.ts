/**
 * Matemática de inventário (funções puras — recalculáveis client-side).
 *
 * Convenção:
 *   - mediaMensal e desvioMensal vêm da RPC `vendas_produto_resumo` (qtd/mês).
 *   - leadDias em dias. Convertemos para meses dividindo por 30.4.
 *   - z é o multiplicador do nível de serviço (1.28 / 1.65 / 2.05).
 *
 * Nada aqui faz round — quem exibe arredonda na renderização.
 */

export type StatusEstoque = "critico" | "repor" | "ok" | "excesso";

const DIAS_POR_MES = 30.4;

export function zFromServico(nivel: 90 | 95 | 98): number {
  switch (nivel) {
    case 90: return 1.28;
    case 95: return 1.65;
    case 98: return 2.05;
  }
}

/** Tempo médio que o estoque atual cobre, em dias. */
export function coberturaDias(estoque: number, mediaMensal: number): number {
  if (!mediaMensal || mediaMensal <= 0) return Infinity;
  return estoque / (mediaMensal / DIAS_POR_MES);
}

/** Giro anual: vendas anuais / estoque atual. null se estoque = 0. */
export function giroAnual(mediaMensal: number, estoque: number): number | null {
  if (!estoque || estoque <= 0) return null;
  return (mediaMensal * 12) / estoque;
}

/** Estoque de segurança: ES = z · σ · √(L/30.4). */
export function estoqueSeguranca(
  desvioMensal: number,
  leadDias: number,
  z: number,
): number {
  if (!desvioMensal || desvioMensal <= 0) return 0;
  return z * desvioMensal * Math.sqrt(leadDias / DIAS_POR_MES);
}

/** Ponto de reposição: ROP = média·(L/30.4) + ES. */
export function pontoReposicao(
  mediaMensal: number,
  desvioMensal: number,
  leadDias: number,
  z: number,
): number {
  return mediaMensal * (leadDias / DIAS_POR_MES) + estoqueSeguranca(desvioMensal, leadDias, z);
}

/** Dias até ruptura no ritmo médio atual. Infinity se média = 0. */
export function diasAteRuptura(estoque: number, mediaMensal: number): number {
  if (!mediaMensal || mediaMensal <= 0) return Infinity;
  if (!estoque || estoque <= 0) return 0;
  return estoque / (mediaMensal / DIAS_POR_MES);
}

/** Data estimada de ruptura (a partir de hoje). null se Infinity. */
export function dataRuptura(estoque: number, mediaMensal: number, base: Date = new Date()): Date | null {
  const d = diasAteRuptura(estoque, mediaMensal);
  if (!Number.isFinite(d)) return null;
  const out = new Date(base);
  out.setDate(out.getDate() + Math.round(d));
  return out;
}

/** Classifica situação do estoque. */
export function statusEstoque(
  estoque: number,
  rop: number,
  es: number,
  cobertura: number,
): StatusEstoque {
  if (estoque <= es) return "critico";
  if (estoque <= rop) return "repor";
  if (Number.isFinite(cobertura) && cobertura > 180) return "excesso";
  return "ok";
}

/** Recomendação de reposição (até cobrir 60 dias acima do ROP). Heurística simples. */
export function quantidadeRepor(
  estoque: number,
  mediaMensal: number,
  rop: number,
): number {
  if (estoque > rop) return 0;
  const alvo = rop + mediaMensal * (60 / DIAS_POR_MES);
  return Math.max(0, Math.round(alvo - estoque));
}
