// Filtros globais da tela Resultados de Vendas (Futura)
// Compartilhado por todos os blocos/hooks para reagirem juntos.
export interface VendasGlobalFilters {
  ano: number;
  /** 1..12 ou null = todos os meses do ano */
  mes: number | null;
  empresa: number | null;
  tabelaPrecoId: number | null;
  uf: string | null;
  clienteId: number | null;
  vendedorId: number | null;
}

export function initialGlobalFilters(ano: number): VendasGlobalFilters {
  return {
    ano,
    mes: null,
    empresa: null,
    tabelaPrecoId: null,
    uf: null,
    clienteId: null,
    vendedorId: null,
  };
}

export const MESES_PT: { value: number; label: string }[] = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

/** Retorna { de, ate } (YYYY-MM-DD) para o ano/mês selecionados.
 *  - Se mes for null: ano inteiro (limitado a hoje quando ano === ano atual).
 *  - Se mes for informado: primeiro ao último dia do mês (limitado a hoje se for o mês atual).
 */
export function computeVendasRange(ano: number, mes: number | null): { de: string; ate: string } {
  const today = new Date();
  const nowY = today.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  if (mes == null) {
    return {
      de: `${ano}-01-01`,
      ate: ano === nowY ? todayStr : `${ano}-12-31`,
    };
  }
  const de = `${ano}-${pad(mes)}-01`;
  const lastDay = new Date(ano, mes, 0).getDate(); // dia 0 do próximo mês = último dia
  let ate = `${ano}-${pad(mes)}-${pad(lastDay)}`;
  if (ano === nowY && mes === today.getMonth() + 1) ate = todayStr;
  return { de, ate };
}
