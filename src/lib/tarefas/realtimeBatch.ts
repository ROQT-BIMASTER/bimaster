/**
 * Fila de eventos Realtime com coalescing e flush em `requestAnimationFrame`.
 *
 * Objetivo: quando chegam vários `postgres_changes` em rajada (criação de
 * subtarefa + contador + responsáveis, por exemplo), agrupá-los para que
 * o `setQueryData` do consumidor rode UMA vez por card afetado por frame,
 * evitando 3 renders consecutivos.
 *
 * Proteções contra crescimento de memória:
 *  - MAX_QUEUE: limite absoluto de eventos vivos por escopo; excedente
 *    dispara o `onOverflow` (o caller decide — normalmente uma
 *    reconciliação em bloco via invalidateQueries com refetchType:"none").
 *  - MAX_PER_FLUSH: teto de eventos processados por frame; o restante
 *    fica para o próximo tick.
 *  - `clear(scope)`: chamado no cleanup do useEffect do canal.
 *  - Coalescing por (scope, id): mantém apenas o evento mais recente do
 *    mesmo id (regra de precedência decidida pelo comparador informado).
 */

import type { RealtimePayload } from "./realtimeReducer";

export interface BatchOptions<T extends Record<string, any>> {
  /** Chave que identifica o escopo da fila (ex: `projetoId` ou `userId`). */
  scope: string;
  /** Handler chamado com os eventos coalescidos deste flush. */
  onFlush: (events: RealtimePayload<T>[]) => void;
  /** Handler opcional para quando a fila estourou o teto. */
  onOverflow?: (dropped: number) => void;
  /**
   * Comparador de precedência para coalescer eventos do mesmo id.
   * Retorno >0 => `a` é mais recente que `b`.
   */
  precedence?: (a: RealtimePayload<T>, b: RealtimePayload<T>) => number;
}

const MAX_QUEUE = 5000;
const MAX_PER_FLUSH = 500;

interface QueueState<T extends Record<string, any>> {
  events: Map<string, RealtimePayload<T>>; // id -> evento coalescido
  raf: number | null;
  opts: BatchOptions<T>;
}

const queues = new Map<string, QueueState<any>>();

function defaultPrecedence<T extends Record<string, any>>(
  a: RealtimePayload<T>,
  b: RealtimePayload<T>,
): number {
  const ac = a.commit_timestamp ?? "";
  const bc = b.commit_timestamp ?? "";
  return ac < bc ? -1 : ac > bc ? 1 : 0;
}

function scheduleFlush<T extends Record<string, any>>(state: QueueState<T>): void {
  if (state.raf !== null) return;
  const flushFn = () => {
    state.raf = null;
    const all = Array.from(state.events.values());
    state.events.clear();
    if (all.length === 0) return;
    const first = all.slice(0, MAX_PER_FLUSH);
    const rest = all.slice(MAX_PER_FLUSH);
    // Reenfileira o excedente (mantém coalescing)
    for (const ev of rest) {
      const id = String((ev.new?.id ?? ev.old?.id ?? "") as string);
      if (id) state.events.set(id, ev);
    }
    if (rest.length > 0) scheduleFlush(state);
    try {
      state.opts.onFlush(first);
    } catch {
      /* handler não pode derrubar o batch */
    }
  };
  if (typeof requestAnimationFrame === "function") {
    state.raf = requestAnimationFrame(() => flushFn()) as unknown as number;
  } else {
    state.raf = setTimeout(flushFn, 0) as unknown as number;
  }
}

function getOrCreate<T extends Record<string, any>>(opts: BatchOptions<T>): QueueState<T> {
  let s = queues.get(opts.scope) as QueueState<T> | undefined;
  if (!s) {
    s = { events: new Map(), raf: null, opts };
    queues.set(opts.scope, s);
  } else {
    // Atualiza handlers (permite hot reload / re-mount do hook)
    s.opts = opts;
  }
  return s;
}

/** Enfileira um evento; agenda flush no próximo frame. */
export function queueRealtimeEvent<T extends Record<string, any>>(
  opts: BatchOptions<T>,
  event: RealtimePayload<T>,
): void {
  const state = getOrCreate(opts);
  const id = String((event.new?.id ?? event.old?.id ?? "") as string);
  if (!id) return;

  const cmp = opts.precedence ?? defaultPrecedence;
  const existing = state.events.get(id);
  if (!existing || cmp(event, existing) >= 0) {
    state.events.set(id, event);
  }

  if (state.events.size > MAX_QUEUE) {
    const overflow = state.events.size - MAX_QUEUE;
    // Descarta os mais antigos (primeiros a entrarem no Map)
    let dropped = 0;
    for (const key of state.events.keys()) {
      if (dropped >= overflow) break;
      state.events.delete(key);
      dropped++;
    }
    opts.onOverflow?.(dropped);
  }

  scheduleFlush(state);
}

/** Cleanup do escopo (chamado no unmount do hook do Realtime). */
export function clearRealtimeBatch(scope: string): void {
  const s = queues.get(scope);
  if (!s) return;
  if (s.raf !== null) {
    if (typeof cancelAnimationFrame === "function") {
      try { cancelAnimationFrame(s.raf); } catch { /* noop */ }
    } else {
      clearTimeout(s.raf);
    }
  }
  queues.delete(scope);
}

/** Introspecção para testes. */
export function _debugQueueSize(scope: string): number {
  return queues.get(scope)?.events.size ?? 0;
}

/** Flush síncrono forçado — apenas para testes. */
export function _flushNow(scope: string): void {
  const s = queues.get(scope);
  if (!s) return;
  if (s.raf !== null) {
    if (typeof cancelAnimationFrame === "function") {
      try { cancelAnimationFrame(s.raf); } catch { /* noop */ }
    } else {
      clearTimeout(s.raf);
    }
    s.raf = null;
  }
  const all = Array.from(s.events.values());
  s.events.clear();
  if (all.length > 0) s.opts.onFlush(all);
}
