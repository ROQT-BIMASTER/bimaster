import type { TabelaCadeiaItem } from "@/hooks/useCadeiaTabelas";

/**
 * Aplica markup a um custo dado o tipo configurado na tabela.
 */
export type TipoMarkup =
  | "percentual"
  | "multiplicador"
  | "valor_fixo"
  | "margem_pct"
  | "desconto_pct";

export function aplicarMarkup(
  custo: number,
  tipo: TipoMarkup,
  valor: number,
): number {
  if (!Number.isFinite(custo) || custo <= 0) return 0;
  switch (tipo) {
    case "percentual":
      return custo * (1 + valor / 100);
    case "multiplicador":
      return custo * valor;
    case "valor_fixo":
      return custo + valor;
    case "margem_pct": {
      // preco = base / (1 - margem). valor em pontos percentuais.
      const m = valor / 100;
      if (m >= 1) return 0;
      return custo / (1 - m);
    }
    case "desconto_pct":
      return custo * (1 - valor / 100);
  }
}

export interface SimulacaoLinha {
  produto_id: string;
  produto_nome: string;
  produto_codigo: string;
  /** Map tabela_id -> preço calculado nessa tabela (cascata). */
  precos: Record<string, number>;
}

export interface ProdutoEscopo {
  produto_id: string;
  produto_nome: string;
  produto_codigo: string;
  /** Custo aprovado na tabela RAIZ (Fábrica). */
  custo_raiz: number;
}

/**
 * Simula em runtime a cascata de preços.
 * - Inicia do custo aprovado na tabela raiz para cada produto.
 * - Propaga sequencialmente pela cadeia, aplicando markup de cada tabela
 *   sobre o preço da tabela base (parent).
 *
 * `cadeia` deve incluir a raiz (nivel=0) e descendentes ordenados por nível.
 */
export function simularCascata(
  produtos: ProdutoEscopo[],
  cadeia: TabelaCadeiaItem[],
): SimulacaoLinha[] {
  const raiz = cadeia.find((t) => t.nivel === 0);
  if (!raiz) return [];

  return produtos.map((p) => {
    const precos: Record<string, number> = {};
    precos[raiz.id] = p.custo_raiz;

    // ordenar por nível garante que parent já foi calculado
    const ordenadas = [...cadeia].sort((a, b) => a.nivel - b.nivel);
    for (const t of ordenadas) {
      if (t.id === raiz.id) continue;
      const baseId = t.tabela_base_id;
      const custoBase = baseId ? precos[baseId] : 0;
      precos[t.id] = aplicarMarkup(custoBase ?? 0, t.tipo_markup, t.valor_markup);
    }

    return {
      produto_id: p.produto_id,
      produto_nome: p.produto_nome,
      produto_codigo: p.produto_codigo,
      precos,
    };
  });
}

/**
 * Valida se a seleção respeita a sequência da cadeia:
 * uma tabela só pode ser marcada se sua tabela_base também estiver marcada
 * (ou for a raiz, que está sempre incluída).
 *
 * Retorna lista de IDs com problema (não cobertos pelo parent).
 */
export function validarSelecaoSequencial(
  selecionadas: Set<string>,
  cadeia: TabelaCadeiaItem[],
  raizId: string,
): string[] {
  const invalidos: string[] = [];
  for (const t of cadeia) {
    if (t.id === raizId) continue;
    if (!selecionadas.has(t.id)) continue;
    if (!t.tabela_base_id) continue;
    if (t.tabela_base_id === raizId) continue;
    if (!selecionadas.has(t.tabela_base_id)) {
      invalidos.push(t.id);
    }
  }
  return invalidos;
}
