/**
 * Calcula a margem de lucro baseada na tabela de origem (tabela base)
 * Se a tabela atual tem uma tabela_base_id, usa o preço_final da tabela base como referência
 * Caso contrário, usa o custo_base como referência
 * 
 * Fórmula: ((preço_atual - preço_referência) / preço_atual) * 100
 */
export interface MargemCalculatorParams {
  precoFinal: number;
  precoTabelaBase?: number | null;
  custoBase?: number | null;
}

/**
 * Calcula a margem de lucro percentual
 * @param precoFinal - Preço final do produto na tabela atual
 * @param precoTabelaBase - Preço final da tabela base (se existir)
 * @param custoBase - Custo base do produto (fallback se não houver tabela base)
 * @returns Margem de lucro percentual
 */
export function calcularMargemComTabelaBase({
  precoFinal,
  precoTabelaBase,
  custoBase
}: MargemCalculatorParams): number {
  if (precoFinal <= 0) return 0;
  
  // Se tem preço da tabela base, usa como referência
  if (precoTabelaBase && precoTabelaBase > 0) {
    return ((precoFinal - precoTabelaBase) / precoFinal) * 100;
  }
  
  // Fallback: usa custo base
  if (custoBase && custoBase > 0) {
    return ((precoFinal - custoBase) / precoFinal) * 100;
  }
  
  return 0;
}

/**
 * Retorna o label apropriado para o valor de referência da margem
 */
export function getLabelReferenciaMargem(temTabelaBase: boolean): string {
  return temTabelaBase ? "Preço Base" : "Custo Base";
}

/**
 * Retorna o valor de referência para cálculo da margem
 */
export function getValorReferenciaMargem(
  precoTabelaBase: number | null | undefined,
  custoBase: number | null | undefined
): number {
  if (precoTabelaBase && precoTabelaBase > 0) {
    return precoTabelaBase;
  }
  return custoBase || 0;
}
