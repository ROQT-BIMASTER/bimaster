/**
 * Famílias de status relacionados.
 *
 * Centraliza o agrupamento de status que devem ser tratados como equivalentes
 * em filtros, KPIs, banners e relatórios. Antes deste módulo, cada tela fazia
 * comparações exatas de string (`status === "em_revisao"`), o que gerava
 * divergência entre o KPI ("Em Revisão" contava 6) e a lista filtrada
 * (mostrava apenas 5, pois `revisao_solicitada` ficava de fora).
 *
 * Use sempre `belongsToFamily` ou `expandFamily` no lugar de comparações
 * literais para que toda a aplicação se mantenha consistente.
 */

// ---------- Ficha (Fábrica → Produtos Acabados / Revisão) ----------

export type FichaStatusValue =
  | "rascunho"
  | "em_revisao"
  | "revisao_solicitada"
  | "aprovada"
  | "sem_ficha";

export type FichaStatusFamily =
  | "rascunho"
  | "em_revisao"   // engloba em_revisao + revisao_solicitada
  | "aprovada"
  | "sem_ficha";

export const FICHA_STATUS_FAMILIES: Record<FichaStatusFamily, ReadonlyArray<FichaStatusValue | null>> = {
  rascunho: ["rascunho"],
  em_revisao: ["em_revisao", "revisao_solicitada"],
  aprovada: ["aprovada"],
  sem_ficha: [null], // ausência de config = sem ficha
};

// ---------- Origem do produto ----------

export type OrigemValue = "nacional" | "importado" | null;
export type OrigemFamily = "nacional" | "importado";

export const ORIGEM_FAMILIES: Record<OrigemFamily, ReadonlyArray<OrigemValue>> = {
  // null/undefined são tratados como nacional por convenção do sistema
  nacional: ["nacional", null],
  importado: ["importado"],
};

// ---------- Vínculos / Aprovações China ↔ Brasil ----------

export type VinculoStatusValue =
  | "pendente"
  | "aguardando_aprovacao"
  | "aprovado"
  | "rejeitado"
  | "cancelado"
  | "ajuste_solicitado";

export type VinculoStatusFamily =
  | "pendente"   // pendente + aguardando_aprovacao + ajuste_solicitado
  | "aprovado"
  | "recusado";  // rejeitado + cancelado

export const VINCULO_STATUS_FAMILIES: Record<VinculoStatusFamily, ReadonlyArray<VinculoStatusValue>> = {
  pendente: ["pendente", "aguardando_aprovacao", "ajuste_solicitado"],
  aprovado: ["aprovado"],
  recusado: ["rejeitado", "cancelado"],
};

// ---------- Helpers ----------

/**
 * Verifica se um valor concreto pertence a uma família.
 * Retorna `true` quando `family === "none"` ou indefinido (sem filtro).
 */
export function belongsToFamily<F extends string, V>(
  value: V,
  family: F | undefined | null,
  table: Record<F, ReadonlyArray<V>>
): boolean {
  if (!family) return true;
  const allowed = table[family];
  if (!allowed) return value === (family as unknown as V);
  return allowed.includes(value);
}

/** Atalho para Ficha. */
export function isFichaInFamily(
  value: FichaStatusValue | null | undefined,
  family: FichaStatusFamily | "none" | undefined
): boolean {
  if (!family || family === "none") return true;
  const v = (value ?? null) as FichaStatusValue | null;
  return (FICHA_STATUS_FAMILIES[family] as ReadonlyArray<FichaStatusValue | null>).includes(v);
}

/** Atalho para Origem. */
export function isOrigemInFamily(
  value: OrigemValue,
  family: OrigemFamily | "none" | undefined
): boolean {
  if (!family || family === "none") return true;
  return (ORIGEM_FAMILIES[family] as ReadonlyArray<OrigemValue>).includes(value);
}

/** Atalho para Vínculos. */
export function isVinculoInFamily(
  value: VinculoStatusValue | null | undefined,
  family: VinculoStatusFamily | "none" | undefined
): boolean {
  if (!family || family === "none") return true;
  if (!value) return false;
  return (VINCULO_STATUS_FAMILIES[family] as ReadonlyArray<VinculoStatusValue>).includes(value);
}

/** Retorna o array de valores brutos de uma família (útil para queries Supabase `.in`). */
export function expandFichaFamily(family: FichaStatusFamily): FichaStatusValue[] {
  return (FICHA_STATUS_FAMILIES[family] as ReadonlyArray<FichaStatusValue | null>)
    .filter((v): v is FichaStatusValue => v !== null);
}

export function expandVinculoFamily(family: VinculoStatusFamily): VinculoStatusValue[] {
  return [...VINCULO_STATUS_FAMILIES[family]];
}

/** Rótulos amigáveis. */
export const FICHA_FAMILY_LABEL: Record<FichaStatusFamily, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em Revisão",
  aprovada: "Aprovada",
  sem_ficha: "Sem Ficha",
};

export const ORIGEM_FAMILY_LABEL: Record<OrigemFamily, string> = {
  nacional: "Nacional",
  importado: "Importado",
};

export const VINCULO_FAMILY_LABEL: Record<VinculoStatusFamily, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
};
