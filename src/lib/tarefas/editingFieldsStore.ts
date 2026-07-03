/**
 * Store leve (sem dependência externa) para rastrear quais campos de
 * quais tarefas estão sendo editados AGORA no drawer/painel.
 *
 * Consumido por:
 *  - `realtimeReducer`: não sobrescreve valor local de um campo travado;
 *    guarda o valor externo como pendente para aplicar após o desbloqueio.
 *  - Componentes: `useIsFieldLocked(id, field)` (React) para UI opcional.
 *
 * Implementação: pub/sub minimalista + `useSyncExternalStore` para React.
 * Não usa Zustand para não adicionar dependência.
 */

import { useSyncExternalStore } from "react";

type Key = string; // `${tarefaId}::${field}`

interface PendingRemote {
  value: unknown;
  at: number;
}

const locks = new Set<Key>();
const pendings = new Map<Key, PendingRemote>();
const listeners = new Set<() => void>();

function keyOf(tarefaId: string, field: string): Key {
  return `${tarefaId}::${field}`;
}

function emit() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* noop */
    }
  }
}

export function lockField(tarefaId: string, field: string): void {
  const k = keyOf(tarefaId, field);
  if (locks.has(k)) return;
  locks.add(k);
  emit();
}

export function unlockField(tarefaId: string, field: string): { pending?: PendingRemote } {
  const k = keyOf(tarefaId, field);
  const had = locks.delete(k);
  const pending = pendings.get(k);
  pendings.delete(k);
  if (had || pending) emit();
  return pending ? { pending } : {};
}

export function isFieldLocked(tarefaId: string, field: string): boolean {
  return locks.has(keyOf(tarefaId, field));
}

/**
 * Registra um valor remoto que chegou enquanto o campo estava travado.
 * Se um pending já existe, mantém apenas o mais recente (`at`).
 */
export function stashPendingRemote(
  tarefaId: string,
  field: string,
  value: unknown,
  at: number = Date.now(),
): void {
  const k = keyOf(tarefaId, field);
  const cur = pendings.get(k);
  if (!cur || at > cur.at) {
    pendings.set(k, { value, at });
  }
}

/** Introspecção para testes. */
export function _resetEditingFieldsStore(): void {
  locks.clear();
  pendings.clear();
  emit();
}

// --- Bindings React ------------------------------------------------------

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useIsFieldLocked(tarefaId: string, field: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isFieldLocked(tarefaId, field),
    () => false,
  );
}
