import { aplicarMarkup, type TipoMarkup } from "@/lib/fabrica/cascataPricing";

export interface TabelaNode {
  id: string;
  nome: string;
  tabela_base_id: string | null;
  tipo_markup: TipoMarkup;
  valor_markup: number;
}

export interface PerfilItemCalc {
  tabela_id: string | null;
  tipo_markup: TipoMarkup;
  valor_markup: number;
}

export interface ProdutoHipotetico {
  id: string;
  descricao: string;
  valor: number;
  /** Tabela em que o `valor` informado já está (null = custo de fábrica / raiz). */
  nivel_id: string | null;
}

/** Markup efetivo de uma tabela considerando o override do perfil. */
export function markupDaTabela(
  tabela: TabelaNode,
  itens: PerfilItemCalc[],
): { tipo: TipoMarkup; valor: number } {
  const override = itens.find((i) => i.tabela_id === tabela.id);
  if (override) return { tipo: override.tipo_markup, valor: override.valor_markup };
  return { tipo: tabela.tipo_markup, valor: tabela.valor_markup };
}

/** Reverte um markup: dado o preço final, retorna o custo base. */
export function reverterMarkup(preco: number, tipo: TipoMarkup, valor: number): number {
  if (!Number.isFinite(preco) || preco <= 0) return 0;
  switch (tipo) {
    case "percentual": {
      const f = 1 + valor / 100;
      return f > 0 ? preco / f : 0;
    }
    case "multiplicador":
      return valor > 0 ? preco / valor : 0;
    case "valor_fixo":
      return preco - valor;
    case "margem_pct": {
      const m = valor / 100;
      if (m >= 1) return 0;
      return preco * (1 - m);
    }
    case "desconto_pct": {
      const f = 1 - valor / 100;
      return f > 0 ? preco / f : 0;
    }
  }
}

/** Caminho da raiz até a tabela informada (exclui a raiz). */
function caminhoAteRaiz(tabelaId: string, mapa: Map<string, TabelaNode>): TabelaNode[] {
  const path: TabelaNode[] = [];
  let atual = mapa.get(tabelaId);
  const visitados = new Set<string>();
  while (atual && !visitados.has(atual.id)) {
    visitados.add(atual.id);
    path.unshift(atual);
    atual = atual.tabela_base_id ? mapa.get(atual.tabela_base_id) : undefined;
  }
  return path;
}

/** Converte um valor informado em qualquer nível para o custo da raiz. */
export function custoRaizDoProduto(
  produto: ProdutoHipotetico,
  tabelas: TabelaNode[],
  itens: PerfilItemCalc[],
): number {
  if (!produto.nivel_id) return produto.valor;
  const mapa = new Map(tabelas.map((t) => [t.id, t]));
  const path = caminhoAteRaiz(produto.nivel_id, mapa);
  let v = produto.valor;
  for (let i = path.length - 1; i >= 0; i--) {
    const { tipo, valor } = markupDaTabela(path[i], itens);
    v = reverterMarkup(v, tipo, valor);
  }
  return v;
}

/** Calcula o preço de cada tabela a partir do custo da raiz. */
export function precosPorTabela(
  custoRaiz: number,
  tabelas: TabelaNode[],
  itens: PerfilItemCalc[],
): Record<string, number> {
  const mapa = new Map(tabelas.map((t) => [t.id, t]));
  const precos: Record<string, number> = {};

  const calcular = (t: TabelaNode, guard: Set<string>): number => {
    if (precos[t.id] !== undefined) return precos[t.id];
    if (guard.has(t.id)) return 0;
    guard.add(t.id);
    const base = t.tabela_base_id ? mapa.get(t.tabela_base_id) : undefined;
    const custoBase = base ? calcular(base, guard) : custoRaiz;
    const { tipo, valor } = markupDaTabela(t, itens);
    precos[t.id] = aplicarMarkup(custoBase, tipo, valor);
    return precos[t.id];
  };

  for (const t of tabelas) calcular(t, new Set());
  return precos;
}

/** Markup efetivo acumulado (preço / custo raiz). */
export function markupEfetivo(preco: number, custoRaiz: number): number {
  if (!custoRaiz || custoRaiz <= 0) return 0;
  return preco / custoRaiz;
}
