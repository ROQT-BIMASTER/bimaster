import type { CenarioProduto } from "@/hooks/useGrupoCenarios";

export interface CustoItemFull {
  produto_id: string;
  codigo: string;
  nome: string;
  fornecedor: string | null;
  tipo_insumo: string | null;
  custo_nf: number;
  custo_servico: number;
  custo_condicao: number;
  custo_nf_made_in: number;
  ipi_valor: number;
  nf_referencia: string | null;
}

export interface CenarioCustoAgg {
  produto: CenarioProduto;
  itens: CustoItemFull[];
  totalInsumos: number;
  ipiTotal: number;
  totalNF: number;
  totalServico: number;
  totalCondicao: number;
  totalNFMadeIn: number;
  custoMaoObraNF: number;
  custoMaoObraServico: number;
  custoFinal: number;
}

export interface ComparativoRow {
  codigo: string;
  nome: string;
  tipo: string;
  marca: string | null;
  cenarioLabel: string;
  custoSim01: number | null;
  custoSim02: number | null;
  delta: number;
  deltaPct: number;
  status: "Reduziu" | "Aumentou" | "Igual" | "Novo" | "Removido";
  observacao: string;
}

export type StatusComparativo = ComparativoRow["status"];

/**
 * Pareia os cenários do grupo pela POSIÇÃO cronológica:
 *  - Sim01 = mais antigo (baseline)
 *  - Cada cenário posterior gera uma linha comparando seu custoFinal vs Sim01.
 *
 * Cenários do mesmo grupo são versões do mesmo produto/projeto; pareá-los
 * por código gera falsos "Novo/Removido" porque cada versão tem código próprio.
 */
export function buildComparativoRows(custosArr: CenarioCustoAgg[]): ComparativoRow[] {
  if (custosArr.length < 2) return [];

  const ordenados = [...custosArr].sort((a, b) =>
    (a.produto.created_at || "").localeCompare(b.produto.created_at || ""),
  );
  const sim01 = ordenados[0];
  const baseline = sim01.custoFinal;

  const rows: ComparativoRow[] = [];

  rows.push({
    codigo: sim01.produto.codigo,
    nome: sim01.produto.nome,
    tipo: (sim01.produto.tipo || "OFICIAL").toUpperCase(),
    marca: sim01.produto.marca,
    cenarioLabel: sim01.produto.cenario_label || "Sim01",
    custoSim01: baseline,
    custoSim02: baseline,
    delta: 0,
    deltaPct: 0,
    status: "Igual",
    observacao: "baseline (Sim01)",
  });

  ordenados.slice(1).forEach((c, idx) => {
    const cB = c.custoFinal;
    const delta = cB - baseline;
    const deltaPct = baseline > 0 ? delta / baseline : 0;

    let status: StatusComparativo;
    let obs: string;
    if (baseline === 0 && cB > 0) {
      status = "Novo";
      obs = "sem custo lançado em Sim01";
    } else if (baseline > 0 && cB === 0) {
      status = "Removido";
      obs = "sem custo lançado neste cenário";
    } else if (Math.abs(delta) < 0.005) {
      status = "Igual";
      obs = "sem mudança vs Sim01";
    } else if (delta > 0) {
      status = "Aumentou";
      obs = `+R$ ${delta.toFixed(4)} (+${(deltaPct * 100).toFixed(2)}%) vs Sim01`;
    } else {
      status = "Reduziu";
      obs = `-R$ ${Math.abs(delta).toFixed(4)} (${(deltaPct * 100).toFixed(2)}%) vs Sim01`;
    }

    rows.push({
      codigo: c.produto.codigo,
      nome: c.produto.nome,
      tipo: (c.produto.tipo || "OFICIAL").toUpperCase(),
      marca: c.produto.marca,
      cenarioLabel: c.produto.cenario_label || `Sim${String(idx + 2).padStart(2, "0")}`,
      custoSim01: baseline,
      custoSim02: cB,
      delta,
      deltaPct,
      status,
      observacao: obs,
    });
  });

  return rows;
}

export interface ResumoComparativo {
  total: number;
  aumentaram: number;
  reduziram: number;
  iguais: number;
  novos: number;
  removidos: number;
  deltaMedioPct: number;
  maiorAlta: ComparativoRow | null;
  maiorQueda: ComparativoRow | null;
}

export function calcResumoComparativo(rows: ComparativoRow[]): ResumoComparativo {
  if (rows.length === 0) {
    return { total: 0, aumentaram: 0, reduziram: 0, iguais: 0, novos: 0, removidos: 0, deltaMedioPct: 0, maiorAlta: null, maiorQueda: null };
  }
  let aumentaram = 0, reduziram = 0, iguais = 0, novos = 0, removidos = 0;
  let somaPct = 0, count = 0;
  let maiorAlta: ComparativoRow | null = null;
  let maiorQueda: ComparativoRow | null = null;
  rows.forEach((r) => {
    if (r.status === "Aumentou") aumentaram++;
    else if (r.status === "Reduziu") reduziram++;
    else if (r.status === "Igual") iguais++;
    else if (r.status === "Novo") novos++;
    else removidos++;
    if (r.custoSim01 != null && r.custoSim02 != null) {
      somaPct += r.deltaPct;
      count++;
    }
    if (r.status === "Aumentou" && (!maiorAlta || r.delta > maiorAlta.delta)) maiorAlta = r;
    if (r.status === "Reduziu" && (!maiorQueda || r.delta < maiorQueda.delta)) maiorQueda = r;
  });
  return {
    total: rows.length,
    aumentaram, reduziram, iguais, novos, removidos,
    deltaMedioPct: count > 0 ? somaPct / count : 0,
    maiorAlta, maiorQueda,
  };
}

export function classificacaoProvador(pct: number): "Eficiente" | "Médio" | "Caro" {
  if (pct < 0.5) return "Eficiente";
  if (pct < 0.7) return "Médio";
  return "Caro";
}
