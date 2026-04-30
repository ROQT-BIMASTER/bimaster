import { useCallback, useEffect, useState } from "react";

/**
 * Persists a user-defined manual ordering of task IDs for the "prioridade"
 * sort mode in the Central de Trabalho. Stored in localStorage per user so
 * it survives reloads without adding a backend column.
 *
 * The list only stores IDs the user has explicitly moved; any task not in
 * the list is appended in its natural priority order.
 */

const KEY_PREFIX = "central:manual-priority-order:";

export function useManualPriorityOrder(userId: string | undefined | null) {
  const storageKey = userId ? KEY_PREFIX + userId : null;
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      setOrder([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      setOrder(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setOrder([]);
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: string[]) => {
      setOrder(next);
      if (!storageKey || typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* quota / private mode — order kept only in memory */
      }
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    persist([]);
  }, [persist]);

  return { order, setOrder: persist, clear };
}

/**
 * Apply a manual ordering on top of an already-sorted list. Items whose IDs
 * appear in `manualOrder` are placed first (in that order); remaining items
 * keep their original relative order.
 */
export function applyManualOrder<T extends { id: string }>(items: T[], manualOrder: string[]): T[] {
  if (manualOrder.length === 0) return items;
  const byId = new Map(items.map((it) => [it.id, it] as const));
  const seen = new Set<string>();
  const head: T[] = [];
  for (const id of manualOrder) {
    const item = byId.get(id);
    if (item) {
      head.push(item);
      seen.add(id);
    }
  }
  const tail = items.filter((it) => !seen.has(it.id));
  return [...head, ...tail];
}
