import type { ProdutoConsolidado } from "@/hooks/useCustosConsolidados";
import { insumoKey, normalizeText, stripQuantidade } from "@/lib/fabrica/normalize";

export interface FiltrosConsolidado {
  busca: string;
  grupos: string[]; // grupo_cenario_id ("__sem__" = sem grupo)
  tipos: string[];
  marcas: string[];
  linhas: string[];
  fornecedores: string[];
  tiposInsumo: string[];
  custoMin: number | null;
  custoMax: number | null;
  deltaMinPct: number | null; // -100..200
  deltaMaxPct: number | null;
  status: string[]; // Aumentou | Reduziu | Igual | Novo | "Só Oficial"
  somenteComMadeIn: boolean;
  somenteComIpi: boolean;
  periodoDias: number | null; // 30, 90, 365 ou null
}

export const FILTROS_DEFAULT: FiltrosConsolidado = {
  busca: "",
  grupos: [],
  tipos: [],
  marcas: [],
  linhas: [],
  fornecedores: [],
  tiposInsumo: [],
  custoMin: null,
  custoMax: null,
  deltaMinPct: null,
  deltaMaxPct: null,
  status: [],
  somenteComMadeIn: false,
  somenteComIpi: false,
  periodoDias: null,
};

export function statusComparativo(p: ProdutoConsolidado): "Aumentou" | "Reduziu" | "Igual" | "Novo" | "Só Oficial" {
  if (p.custoFinalSim01 == null) return "Só Oficial";
  const delta = p.custoFinal - p.custoFinalSim01;
  if (p.custoFinal === p.custoFinalSim01) return "Novo"; // mesmo registro = primeiro do grupo
  if (Math.abs(delta) < 0.005) return "Igual";
  return delta > 0 ? "Aumentou" : "Reduziu";
}

export function deltaPct(p: ProdutoConsolidado): number | null {
  if (!p.custoFinalSim01 || p.custoFinalSim01 <= 0) return null;
  if (p.custoFinal === p.custoFinalSim01) return 0;
  return (p.custoFinal - p.custoFinalSim01) / p.custoFinalSim01;
}

export function aplicarFiltros(produtos: ProdutoConsolidado[], f: FiltrosConsolidado): ProdutoConsolidado[] {
  const q = f.busca.trim().toLowerCase();
  const agora = Date.now();
  return produtos.filter((p) => {
    if (q) {
      const hayProduto = `${p.produto.codigo} ${p.produto.nome} ${p.grupoNome}`.toLowerCase();
      const hayItens = p.itens.some(
        (i) =>
          (i.codigo || "").toLowerCase().includes(q) ||
          (i.nome || "").toLowerCase().includes(q) ||
          (i.fornecedor || "").toLowerCase().includes(q) ||
          (i.nf_referencia || "").toLowerCase().includes(q),
      );
      if (!hayProduto.includes(q) && !hayItens) return false;
    }
    if (f.grupos.length) {
      const key = p.grupoId ?? "__sem__";
      if (!f.grupos.includes(key)) return false;
    }
    if (f.tipos.length) {
      const tipo = (p.produto.tipo || "OFICIAL").toUpperCase();
      if (!f.tipos.includes(tipo)) return false;
    }
    if (f.marcas.length && !f.marcas.includes(p.produto.marca || "—")) return false;
    if (f.linhas.length && !f.linhas.includes(p.produto.linha || "—")) return false;
    if (f.fornecedores.length) {
      const set = new Set(p.itens.map((i) => i.fornecedor || "—"));
      if (![...set].some((x) => f.fornecedores.includes(x))) return false;
    }
    if (f.tiposInsumo.length) {
      const set = new Set(p.itens.map((i) => i.tipo_insumo || "—"));
      if (![...set].some((x) => f.tiposInsumo.includes(x))) return false;
    }
    if (f.custoMin != null && p.custoFinal < f.custoMin) return false;
    if (f.custoMax != null && p.custoFinal > f.custoMax) return false;
    const dp = deltaPct(p);
    if (f.deltaMinPct != null && (dp == null || dp * 100 < f.deltaMinPct)) return false;
    if (f.deltaMaxPct != null && (dp == null || dp * 100 > f.deltaMaxPct)) return false;
    if (f.status.length && !f.status.includes(statusComparativo(p))) return false;
    if (f.somenteComMadeIn && p.totalNFMadeIn <= 0) return false;
    if (f.somenteComIpi && p.ipiTotal <= 0) return false;
    if (f.periodoDias) {
      const created = new Date(p.produto.created_at).getTime();
      const limite = agora - f.periodoDias * 24 * 3600 * 1000;
      if (created < limite) return false;
    }
    return true;
  });
}

export interface AggInsumoFornecedor {
  chave: string;
  insumoCodigo: string; // código canônico (mais frequente)
  insumoNome: string;   // descrição canônica (mais frequente)
  fornecedor: string;   // fornecedor canônico (primeira ocorrência)
  tipoInsumo: string;
  codigos: string[];    // todos os códigos distintos vistos no grupo
  nProdutos: number;
  custoMedio: number;
  custoMin: number;
  custoMax: number;
  variacao: number; // (max-min)/min
  totalAcumulado: number;
  ultimaNF: string | null;
  ultimoUso: string; // ISO created_at do produto mais recente
}

function custoUnitario(i: { custo_nf: number; custo_servico: number; custo_condicao: number; custo_nf_made_in: number; ipi_valor: number }) {
  return i.custo_nf + i.custo_servico + i.custo_condicao + i.custo_nf_made_in + i.ipi_valor;
}

function pickMode(counts: Map<string, number>): string {
  let best = "";
  let bestN = -1;
  counts.forEach((n, k) => {
    if (n > bestN || (n === bestN && k && !best)) {
      best = k;
      bestN = n;
    }
  });
  return best;
}

interface InternalAgg {
  chave: string;
  fornecedor: string;
  tipoInsumo: string;
  codigosCount: Map<string, number>;
  nomesCount: Map<string, number>;
  produtos: Set<string>;
  soma: number;
  count: number;
  custoMin: number;
  custoMax: number;
  totalAcumulado: number;
  ultimaNF: string | null;
  ultimoUso: string;
}

export function agregarInsumosFornecedores(produtos: ProdutoConsolidado[]): AggInsumoFornecedor[] {
  const map = new Map<string, InternalAgg>();
  produtos.forEach((p) => {
    p.itens.forEach((i) => {
      const codigo = (i.codigo || "").trim();
      const nome = stripQuantidade(i.nome);
      const fornecedor = (i.fornecedor || "—").trim();
      const tipoInsumo = (i.tipo_insumo || "—").trim();
      const chave = insumoKey(nome, fornecedor);
      const c = custoUnitario(i);
      let ex = map.get(chave);
      if (!ex) {
        ex = {
          chave,
          fornecedor,
          tipoInsumo,
          codigosCount: new Map(),
          nomesCount: new Map(),
          produtos: new Set(),
          soma: 0,
          count: 0,
          custoMin: c,
          custoMax: c,
          totalAcumulado: 0,
          ultimaNF: i.nf_referencia ?? null,
          ultimoUso: p.produto.created_at,
        };
        map.set(chave, ex);
      }
      if (codigo) ex.codigosCount.set(codigo, (ex.codigosCount.get(codigo) || 0) + 1);
      if (nome) ex.nomesCount.set(nome, (ex.nomesCount.get(nome) || 0) + 1);
      ex.produtos.add(p.produto.id);
      ex.soma += c;
      ex.count += 1;
      ex.custoMin = Math.min(ex.custoMin, c);
      ex.custoMax = Math.max(ex.custoMax, c);
      ex.totalAcumulado += c;
      if (p.produto.created_at > ex.ultimoUso) {
        ex.ultimoUso = p.produto.created_at;
        ex.ultimaNF = i.nf_referencia ?? ex.ultimaNF;
      }
    });
  });
  const out: AggInsumoFornecedor[] = Array.from(map.values()).map((x) => {
    const codigos = Array.from(x.codigosCount.keys()).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return {
      chave: x.chave,
      insumoCodigo: pickMode(x.codigosCount) || "—",
      insumoNome: pickMode(x.nomesCount) || "—",
      fornecedor: x.fornecedor,
      tipoInsumo: x.tipoInsumo,
      codigos,
      nProdutos: x.produtos.size,
      custoMedio: x.count > 0 ? x.soma / x.count : 0,
      custoMin: x.custoMin,
      custoMax: x.custoMax,
      variacao: x.custoMin > 0 ? (x.custoMax - x.custoMin) / x.custoMin : 0,
      totalAcumulado: x.totalAcumulado,
      ultimaNF: x.ultimaNF,
      ultimoUso: x.ultimoUso,
    };
  });
  out.sort((a, b) => b.variacao - a.variacao || b.totalAcumulado - a.totalAcumulado);
  return out;
}

/** Grupos com >=2 códigos distintos para a mesma descrição+fornecedor normalizados. */
export function detectarDuplicados(produtos: ProdutoConsolidado[]): AggInsumoFornecedor[] {
  return agregarInsumosFornecedores(produtos).filter((g) => g.codigos.length >= 2);
}

export { normalizeText };


export interface AggFornecedor {
  fornecedor: string;
  nProdutos: number;
  nInsumos: number;
  totalMovimentado: number;
  ticketMedio: number;
  deltaPctMedio: number | null;
}

export function agregarFornecedores(produtos: ProdutoConsolidado[]): AggFornecedor[] {
  const map = new Map<
    string,
    {
      fornecedor: string;
      produtos: Set<string>;
      insumos: Set<string>;
      total: number;
      count: number;
      somaDeltaPct: number;
      countDelta: number;
    }
  >();
  produtos.forEach((p) => {
    const dp = deltaPct(p);
    const fornecedoresDoProduto = new Set<string>();
    p.itens.forEach((i) => {
      const f = (i.fornecedor || "—").trim();
      fornecedoresDoProduto.add(f);
      const c = custoUnitario(i);
      const ex = map.get(f);
      if (!ex) {
        map.set(f, {
          fornecedor: f,
          produtos: new Set([p.produto.id]),
          insumos: new Set([`${i.codigo}||${i.nome}`]),
          total: c,
          count: 1,
          somaDeltaPct: 0,
          countDelta: 0,
        });
      } else {
        ex.produtos.add(p.produto.id);
        ex.insumos.add(`${i.codigo}||${i.nome}`);
        ex.total += c;
        ex.count += 1;
      }
    });
    // dp por fornecedor: soma 1x por (produto, fornecedor)
    if (dp != null) {
      fornecedoresDoProduto.forEach((f) => {
        const ex = map.get(f);
        if (ex) {
          ex.somaDeltaPct += dp;
          ex.countDelta += 1;
        }
      });
    }
  });
  const out: AggFornecedor[] = Array.from(map.values()).map((x) => ({
    fornecedor: x.fornecedor,
    nProdutos: x.produtos.size,
    nInsumos: x.insumos.size,
    totalMovimentado: x.total,
    ticketMedio: x.count > 0 ? x.total / x.count : 0,
    deltaPctMedio: x.countDelta > 0 ? x.somaDeltaPct / x.countDelta : null,
  }));
  out.sort((a, b) => b.totalMovimentado - a.totalMovimentado);
  return out;
}

export function distinct(values: (string | null | undefined)[], fallback = "—"): string[] {
  const set = new Set<string>();
  values.forEach((v) => set.add((v || fallback).trim() || fallback));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
