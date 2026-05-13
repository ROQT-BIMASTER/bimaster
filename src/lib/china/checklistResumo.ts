/**
 * Resumo de checklist para a Linha do Tempo (Stage 2/3/4).
 *
 * Função PURA, sem React/Supabase, para que tenha testes determinísticos e
 * para que o hook `useDocsResumo` na timeline e a Caixa de Entrada compartilhem
 * EXATAMENTE a mesma classificação.
 *
 * Regra (espelha `groupMailboxItems.classifyForProgress`):
 *  - Tipo do checklist SEM nenhum documento anexado          → pendente.
 *  - Tipo com documento anexado em status "rascunho"         → pendente.
 *  - Tipo com documento anexado em qualquer outro status     → enviado ao
 *    Brasil. Adicionalmente, "aprovado" e "rejeitado" também são contabilizados
 *    nos respectivos buckets (ainda contam como enviados).
 *
 * O universo considerado é a UNIÃO de:
 *  - tipos esperados (checklist mesclado de `computeExpectedChecklist`);
 *  - tipos que já têm documento anexado (mesmo se não estiverem mais no
 *    checklist por terem sido ocultos depois) — não perder vínculo com nada
 *    que esteja salvo.
 */
import type { ExpectedChecklistStats } from "./mergeChecklist";

export interface ChecklistDocRow {
  tipo_documento: string;
  status: string;
  /** Opcional — usado só para `ultimoEm`/`ultimoStatus` quando informado. */
  updated_at?: string | null;
  created_at?: string | null;
}

export interface ChecklistResumo {
  /** Total esperado = união(checklist visível, tipos com doc anexado). */
  total: number;
  /** Itens sem doc OU em rascunho. */
  pendentes: number;
  /** Itens com doc fora de rascunho (inclui aprovado/rejeitado/em análise). */
  enviados: number;
  /** Subset de enviados aprovados pelo Brasil. */
  aprovados: number;
  /** Subset de enviados rejeitados pelo Brasil. */
  rejeitados: number;
}

export function summarizeChecklistResumo(
  rows: ChecklistDocRow[],
  expected: ExpectedChecklistStats,
): ChecklistResumo {
  // Mapa tipo → último doc. Assume `rows` ordenado desc por updated_at; em
  // caso contrário, a ordem ainda é estável (primeiro encontrado vence).
  const latestByTipo = new Map<string, ChecklistDocRow>();
  for (const r of rows) {
    if (!latestByTipo.has(r.tipo_documento)) latestByTipo.set(r.tipo_documento, r);
  }

  const universe = new Set<string>(expected.tipos);
  for (const tipo of latestByTipo.keys()) universe.add(tipo);

  let pendentes = 0, aprovados = 0, rejeitados = 0, enviados = 0;
  for (const tipo of universe) {
    const doc = latestByTipo.get(tipo);
    const status = doc?.status ?? null;
    const sentToBrazil = !!doc && status !== null && status !== "rascunho";
    if (sentToBrazil) enviados += 1;
    else pendentes += 1;
    if (status === "aprovado") aprovados += 1;
    else if (status === "rejeitado") rejeitados += 1;
  }

  return {
    total: universe.size,
    pendentes,
    enviados,
    aprovados,
    rejeitados,
  };
}

/**
 * Validação de consistência: garante a invariante
 *   total === pendentes + enviados
 * e que aprovados + rejeitados ≤ enviados.
 *
 * Retorna `null` quando consistente; caso contrário, mensagem descritiva.
 * Útil em testes e em um `console.warn` defensivo na UI.
 */
export function validateChecklistResumo(r: ChecklistResumo): string | null {
  if (r.pendentes + r.enviados !== r.total) {
    return `Inconsistência: pendentes(${r.pendentes}) + enviados(${r.enviados}) ≠ total(${r.total})`;
  }
  if (r.aprovados + r.rejeitados > r.enviados) {
    return `Inconsistência: aprovados(${r.aprovados}) + rejeitados(${r.rejeitados}) > enviados(${r.enviados})`;
  }
  if (r.aprovados < 0 || r.rejeitados < 0 || r.enviados < 0 || r.pendentes < 0 || r.total < 0) {
    return `Inconsistência: contagens negativas`;
  }
  return null;
}
