/**
 * Rastreia mutations locais recentes por (tarefaId, campo) para permitir
 * ao reducer de Realtime descartar o "echo" da própria mutation e evitar
 * re-render desnecessário do card já atualizado otimisticamente.
 *
 * Ciclo de vida: entradas com TTL curto (janela padrão 1500 ms) — passado
 * o TTL, o registro é considerado expirado e o dedupe deixa de bloquear
 * eventos genuínos com o mesmo id.
 *
 * Não é um store React (sem re-render); é um mapa em memória de módulo.
 */

const DEFAULT_TTL_MS = 1500;

interface Entry {
  at: number;
  fields: Set<string>;
}

const store = new Map<string, Entry>();

/** Marca uma mutation local em `tarefaId` afetando `fields`. */
export function trackLocalMutation(
  tarefaId: string,
  fields: readonly string[],
  now: number = Date.now(),
): void {
  const existing = store.get(tarefaId);
  if (existing && now - existing.at < DEFAULT_TTL_MS) {
    for (const f of fields) existing.fields.add(f);
    existing.at = now;
    return;
  }
  store.set(tarefaId, { at: now, fields: new Set(fields) });
}

/**
 * `true` se o evento remoto provavelmente é echo de uma mutation local
 * recente. Se `field` for informado, só bloqueia quando aquele campo
 * específico foi tocado localmente (evita mascarar mudanças em outros
 * campos feitas por outro usuário na mesma janela).
 */
export function isEchoOfLocalMutation(
  tarefaId: string,
  now: number = Date.now(),
  field?: string,
  ttlMs: number = DEFAULT_TTL_MS,
): boolean {
  const e = store.get(tarefaId);
  if (!e) return false;
  if (now - e.at > ttlMs) {
    store.delete(tarefaId);
    return false;
  }
  return field ? e.fields.has(field) : true;
}

/** Limpeza manual — útil em testes e em unmount do hook Realtime. */
export function clearLocalMutationTracker(): void {
  store.clear();
}

/** Introspecção para testes/telemetria. */
export function _debugSnapshot(): Array<{ id: string; at: number; fields: string[] }> {
  return Array.from(store.entries()).map(([id, e]) => ({
    id,
    at: e.at,
    fields: Array.from(e.fields),
  }));
}
