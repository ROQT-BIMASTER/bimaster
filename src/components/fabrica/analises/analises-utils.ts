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
  custoSim01: number | null;
  custoSim02: number | null;
  delta: number;
  deltaPct: number;
  status: "Reduziu" | "Aumentou" | "Igual" | "Novo" | "Removido";
  observacao: string;
}

export type StatusComparativo = ComparativoRow["status"];

function chave(c: CenarioProduto): string {
  return (c.codigo || c.nome || "").trim().toLowerCase();
}

/**
 * Pareia os 2 (ou N>1) cenários do grupo em linhas comparativas.
 * O primeiro cenário cronológico = Sim01; o último = Sim02 (atual).
 */
export function buildComparativoRows(custosArr: CenarioCustoAgg[]): ComparativoRow[] {
  if (custosArr.length < 2) return [];

  // Ordena por created_at: primeiro = Sim01, último = Sim02
  const ordenados = [...custosArr].sort((a, b) =>
    (a.produto.created_at || "").localeCompare(b.produto.created_at || ""),
  );
  const sim01 = ordenados[0];
  const sim02 = ordenados[ordenados.length - 1];

  const mapA = new Map<string, CenarioCustoAgg>();
  const mapB = new Map<string, CenarioCustoAgg>();
  // Quando o grupo tem 2 cenários (cada um = 1 produto), trata cada produto como linha.
  // Quando há mais cenários, mantém o pareamento por (Sim01, Sim02).
  mapA.set(chave(sim01.produto), sim01);
  mapB.set(chave(sim02.produto), sim02);

  const keys = new Set<string>([...mapA.keys(), ...mapB.keys()]);
  const rows: ComparativoRow[] = [];
  keys.forEach((k) => {
    const a = mapA.get(k);
    const b = mapB.get(k);
    const ref = (b ?? a)!.produto;
    const cA = a ? a.custoFinal : null;
    const cB = b ? b.custoFinal : null;
    const delta = (cB ?? 0) - (cA ?? 0);
    const deltaPct = cA && cA > 0 ? delta / cA : 0;

    let status: StatusComparativo;
    let obs: string;
    if (cA == null && cB != null) {
      status = "Novo";
      obs = "presente apenas no cenário atual";
    } else if (cA != null && cB == null) {
      status = "Removido";
      obs = "presente apenas no Sim01";
    } else if (Math.abs(delta) < 0.005) {
      status = "Igual";
      obs = "sem mudança entre versões";
    } else if (delta > 0) {
      status = "Aumentou";
      obs = `+R$ ${delta.toFixed(4)} (+${(deltaPct * 100).toFixed(2)}%)`;
    } else {
      status = "Reduziu";
      obs = `-R$ ${Math.abs(delta).toFixed(4)} (${(deltaPct * 100).toFixed(2)}%)`;
    }

    rows.push({
      codigo: ref.codigo,
      nome: ref.nome,
      tipo: (ref.tipo || "OFICIAL").toUpperCase(),
      marca: ref.marca,
      custoSim01: cA,
      custoSim02: cB,
      delta,
      deltaPct,
      status,
      observacao: obs,
    });
  });

  // Ordena por |Δ%| desc, depois por |Δ R$| desc
  rows.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct) || Math.abs(b.delta) - Math.abs(a.delta));
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
