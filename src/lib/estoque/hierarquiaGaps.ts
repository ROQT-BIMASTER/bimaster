/**
 * Análise derivada de "lacunas" (gaps) na hierarquia CX → BX → UN
 * do breakdown de SKUs do Estoque Unificado.
 *
 * Função pura — opera sobre a árvore já construída pelo componente
 * EstoqueUnificadoSkuBreakdown. Não faz I/O, não toca em RPCs.
 */

export type GapStatus = "ok" | "faltante" | "sem_filhos_mapeados";

export interface GapSkuNode {
  cod_produto: number;
  nome_prod: string | null;
  nivel: number | null;
  saldo: number | null;
  disponivel: number | null;
  pai_cod?: number | null;
}

export interface GapTreeNode<T extends GapSkuNode = GapSkuNode> {
  sku: T;
  children: GapTreeNode<T>[];
}

export interface CorFaltante {
  codigo: number;
  nome: string;
  paiBX: string;
}

export interface GapsResumo {
  totalNos: number;
  faltantesCX: number;
  faltantesBX: number;
  faltantesUN: number;
  semFilhosMapeados: number;
  coresFaltantes: CorFaltante[];
  /** Map codigo → status */
  statusByCodigo: Map<number, GapStatus>;
  /** Conjunto de códigos de nós que estão num ramo com qualquer gap (eles ou descendentes) */
  ramosComGap: Set<number>;
}

export interface ClassificarGapsOptions {
  /** Qual valor considerar como "tem físico". Default: disponivel. */
  usar?: "saldo" | "disponivel";
}

function valor(sku: GapSkuNode, modo: "saldo" | "disponivel"): number {
  const raw = modo === "disponivel" ? sku.disponivel ?? sku.saldo : sku.saldo;
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function classificarGaps<T extends GapSkuNode>(
  tree: GapTreeNode<T>[],
  options: ClassificarGapsOptions = {},
): GapsResumo {
  const modo = options.usar ?? "disponivel";
  const statusByCodigo = new Map<number, GapStatus>();
  const ramosComGap = new Set<number>();
  const coresFaltantes: CorFaltante[] = [];
  let faltantesCX = 0;
  let faltantesBX = 0;
  let faltantesUN = 0;
  let semFilhosMapeados = 0;
  let totalNos = 0;

  /**
   * Retorna true se este nó (ou algum descendente) tem gap.
   * paiTemSaldo: o ancestral mais próximo com saldo > 0.
   */
  const walk = (node: GapTreeNode<T>, paiTemSaldo: boolean, paiBXNome: string | null): boolean => {
    totalNos++;
    const v = valor(node.sku, modo);
    const temSaldo = v > 0;
    let status: GapStatus = "ok";
    let temGapAqui = false;

    if (!temSaldo && paiTemSaldo) {
      status = "faltante";
      temGapAqui = true;
      if (node.sku.nivel === 1) faltantesCX++;
      else if (node.sku.nivel === 2) faltantesBX++;
      else if (node.sku.nivel === 3) {
        faltantesUN++;
        coresFaltantes.push({
          codigo: node.sku.cod_produto,
          nome: node.sku.nome_prod ?? `Produto ${node.sku.cod_produto}`,
          paiBX: paiBXNome ?? "—",
        });
      }
    } else if (temSaldo && (node.sku.nivel === 1 || node.sku.nivel === 2) && node.children.length === 0) {
      status = "sem_filhos_mapeados";
      temGapAqui = true;
      semFilhosMapeados++;
    }

    statusByCodigo.set(node.sku.cod_produto, status);

    const proximoPaiBX = node.sku.nivel === 2 ? node.sku.nome_prod ?? `BX ${node.sku.cod_produto}` : paiBXNome;
    let algumDescendenteComGap = false;
    for (const child of node.children) {
      const childGap = walk(child, temSaldo || paiTemSaldo, proximoPaiBX);
      if (childGap) algumDescendenteComGap = true;
    }

    const ramoTemGap = temGapAqui || algumDescendenteComGap;
    if (ramoTemGap) ramosComGap.add(node.sku.cod_produto);
    return ramoTemGap;
  };

  for (const root of tree) walk(root, false, null);

  return {
    totalNos,
    faltantesCX,
    faltantesBX,
    faltantesUN,
    semFilhosMapeados,
    coresFaltantes,
    statusByCodigo,
    ramosComGap,
  };
}

export function temAlgumGap(r: GapsResumo): boolean {
  return r.faltantesCX + r.faltantesBX + r.faltantesUN + r.semFilhosMapeados > 0;
}
