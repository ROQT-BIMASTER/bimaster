/**
 * Funções puras de merge do checklist China — replicam a mesma lógica de
 * `useMergedChinaChecklist`, mas sem React, para que possam ser usadas em
 * batch pelo hook da Caixa de Entrada (`useChinaMailbox`) e por testes.
 *
 * O contrato é: dados as 4 fontes de customização (categorias custom, itens
 * custom, ocultos, overrides de label), retorna o conjunto VISÍVEL de
 * `tipo_key` esperados para uma submissão.
 */
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES } from "@/lib/china-document-types";

export interface ChecklistTipoLabel {
  pt: string;
  cn?: string;
}

export interface ChecklistCustomCategory {
  id: string;
  submissao_id: string;
  fluxo: "china_envia" | "brasil_envia";
  label_pt?: string;
  label_cn?: string;
  ordem?: number;
}

export interface ChecklistCustomItem {
  id: string;
  submissao_id: string;
  tipo_key: string;
  label_pt?: string;
  label_cn?: string;
  categoria_default_key?: string | null;
  categoria_custom_id?: string | null;
}

export interface ChecklistHiddenItem {
  submissao_id: string;
  tipo_key: string; // "tipo_xxx" ou "cat:KEY"
}

export interface ExpectedChecklistStats {
  /** Tipos de documento esperados (visíveis após overrides/oculto/custom). */
  tipos: Set<string>;
  /** Total — equivalente a `tipos.size`. */
  total: number;
  /** Tipos esperados no fluxo China envia. */
  tiposChinaEnvia: Set<string>;
  /** Tipos esperados no fluxo Brasil envia. */
  tiposBrasilEnvia: Set<string>;
  /**
   * Mapa `tipo_key → { pt, cn }` com o nome configurado do item no checklist
   * (padrão de `CHINA_DOCUMENT_TYPES` ou `label_pt`/`label_cn` do item custom).
   * Permite à Caixa de Entrada e ao drawer de pendências mostrar o nome real
   * em vez da chave bruta (ex.: "Faca Display" em vez de "faca_display").
   */
  labels: Map<string, ChecklistTipoLabel>;
}

const EMPTY: ExpectedChecklistStats = {
  tipos: new Set(),
  total: 0,
  tiposChinaEnvia: new Set(),
  tiposBrasilEnvia: new Set(),
  labels: new Map(),
};

/**
 * Calcula os tipos de checklist esperados para UMA submissão.
 * Reproduz exatamente o merge de `useMergedChinaChecklist`.
 */
export function computeExpectedChecklist(
  customCats: ChecklistCustomCategory[],
  customItems: ChecklistCustomItem[],
  hidden: ChecklistHiddenItem[],
): ExpectedChecklistStats {
  const hiddenSet = new Set(hidden.map((h) => h.tipo_key));

  // Categorias padrão (com itens extras vindos de customItems sem categoria custom).
  const defaultMerged = DOCUMENT_CATEGORIES.map((cat) => {
    const extras = customItems
      .filter((i) => i.categoria_default_key === cat.key && !i.categoria_custom_id)
      .map((i) => i.tipo_key);
    return {
      key: cat.key,
      tipos: [...cat.tipos, ...extras],
      fluxo: cat.fluxo,
    };
  });

  // Categorias custom.
  const customMerged = customCats.map((c) => ({
    key: `custom_${c.id}`,
    tipos: customItems
      .filter((i) => i.categoria_custom_id === c.id)
      .map((i) => i.tipo_key),
    fluxo: c.fluxo,
  }));

  const all = [...defaultMerged, ...customMerged];
  const visible = all.filter((c) => !hiddenSet.has(`cat:${c.key}`));

  const tipos = new Set<string>();
  const tiposChinaEnvia = new Set<string>();
  const tiposBrasilEnvia = new Set<string>();

  for (const cat of visible) {
    for (const t of cat.tipos) {
      if (hiddenSet.has(t)) continue;
      tipos.add(t);
      if (cat.fluxo === "china_envia") tiposChinaEnvia.add(t);
      else tiposBrasilEnvia.add(t);
    }
  }

  return {
    tipos,
    total: tipos.size,
    tiposChinaEnvia,
    tiposBrasilEnvia,
  };
}

/**
 * Versão em LOTE — agrupa as fontes pelo `submissao_id` e retorna o mapa
 * `subId → ExpectedChecklistStats`. Usado pela Caixa de Entrada para evitar
 * N+1 queries.
 */
export function computeExpectedChecklistBatch(
  subIds: string[],
  customCats: ChecklistCustomCategory[],
  customItems: ChecklistCustomItem[],
  hidden: ChecklistHiddenItem[],
): Map<string, ExpectedChecklistStats> {
  const catsBy = new Map<string, ChecklistCustomCategory[]>();
  const itensBy = new Map<string, ChecklistCustomItem[]>();
  const hiddenBy = new Map<string, ChecklistHiddenItem[]>();

  for (const c of customCats) {
    const arr = catsBy.get(c.submissao_id) ?? [];
    arr.push(c);
    catsBy.set(c.submissao_id, arr);
  }
  for (const i of customItems) {
    const arr = itensBy.get(i.submissao_id) ?? [];
    arr.push(i);
    itensBy.set(i.submissao_id, arr);
  }
  for (const h of hidden) {
    const arr = hiddenBy.get(h.submissao_id) ?? [];
    arr.push(h);
    hiddenBy.set(h.submissao_id, arr);
  }

  const out = new Map<string, ExpectedChecklistStats>();
  for (const id of subIds) {
    out.set(
      id,
      computeExpectedChecklist(
        catsBy.get(id) ?? [],
        itensBy.get(id) ?? [],
        hiddenBy.get(id) ?? [],
      ),
    );
  }
  return out;
}

/** Total de tipos do checklist PADRÃO (sem customização) — usado como fallback. */
export const DEFAULT_EXPECTED_TOTAL = CHINA_DOCUMENT_TYPES.length;
