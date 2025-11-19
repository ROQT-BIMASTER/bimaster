export interface ItemComCusto {
  quantidade: number;
  custo_unitario: number;
}

export function calcularCustoFormula(itens: ItemComCusto[]): number {
  return itens.reduce((total, item) => {
    return total + item.quantidade * item.custo_unitario;
  }, 0);
}

export function calcularCustoUnitario(
  custoTotal: number,
  rendimento: number
): number {
  if (rendimento <= 0) return 0;
  return custoTotal / rendimento;
}

export function calcularMargemLucro(
  custoUnitario: number,
  precoVenda: number
): number {
  if (precoVenda <= 0) return 0;
  return ((precoVenda - custoUnitario) / precoVenda) * 100;
}
