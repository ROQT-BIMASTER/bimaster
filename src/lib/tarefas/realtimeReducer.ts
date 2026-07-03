/**
 * Reducer puro para aplicar um evento do Supabase Realtime sobre uma
 * tarefa no cache do React Query.
 *
 * Regras (v3):
 *  - Precedência de ordenação: `version` > `updated_at` > `commit_timestamp`.
 *    Um evento mais antigo que o cache é descartado silenciosamente.
 *  - Dedupe de echo: se `isEchoOfLocalMutation(id, ..., field?)` bater,
 *    o evento é descartado (o patch otimista já refletiu na UI).
 *  - Patch granular: só os campos que mudaram entre `payload.old` e
 *    `payload.new` são copiados; o restante mantém a mesma referência para
 *    não invalidar `React.memo` nos filhos.
 *  - Campos editáveis travados (`isFieldLocked`) são preservados no local
 *    e o valor remoto é empilhado como pendente (`stashPendingRemote`)
 *    para ser reavaliado quando o usuário liberar o campo.
 *  - Coleções aninhadas usam `mergeById` (evita perda em edições concorrentes).
 *
 * Pura: recebe funções injetadas (dedupe, lock, stash) para facilitar teste.
 */

import { mergeById, type ColecaoItem } from "./mergeColecoes";

export type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE";

export interface RealtimePayload<T extends Record<string, unknown> = Record<string, unknown>> {
  eventType: RealtimeEventType;
  new: T | null;
  old: Partial<T> | null;
  commit_timestamp?: string;
}

/** Campos que o usuário pode editar em foco no drawer (não sobrescrever). */
export const EDITABLE_FIELDS = [
  "titulo",
  "descricao",
  "checklist_texto",
  "estimativa",
  "data_prazo",
  "data_inicio",
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

/** Chaves que representam coleções aninhadas mescladas por id. */
export const COLLECTION_FIELDS = [
  "responsaveis",
  "seguidores",
  "anexos",
  "checklist",
  "comentarios",
] as const;
export type CollectionField = (typeof COLLECTION_FIELDS)[number];

export interface ReducerDeps {
  /** Retorna `true` para descartar echo de mutation local. */
  isEcho: (id: string, field?: string) => boolean;
  /** Retorna `true` se o campo está em edição no drawer. */
  isLocked: (id: string, field: string) => boolean;
  /** Empilha valor remoto para aplicar após unlock. */
  stashPending: (id: string, field: string, value: unknown) => void;
}

/**
 * Precedência de recência. Retorna:
 *   >0 se `a` é mais recente que `b`
 *   <0 se `a` é mais antigo que `b`
 *   =0 se equivalentes
 */
export function comparePrecedence(
  a: { version?: number | null; updated_at?: string | null; commit_timestamp?: string | null },
  b: { version?: number | null; updated_at?: string | null; commit_timestamp?: string | null },
): number {
  const av = a.version ?? null;
  const bv = b.version ?? null;
  if (av !== null && bv !== null) return av - bv;
  const au = a.updated_at ?? "";
  const bu = b.updated_at ?? "";
  if (au !== bu) return au < bu ? -1 : 1;
  const ac = a.commit_timestamp ?? "";
  const bc = b.commit_timestamp ?? "";
  if (ac !== bc) return ac < bc ? -1 : 1;
  return 0;
}

export interface ApplyResult<T> {
  next: T | null; // null => remover do cache (DELETE)
  changed: boolean; // false => nada mudou (mesma referência)
}

/**
 * Aplica um payload sobre um objeto de tarefa. Se `current` for `null` e o
 * evento não for INSERT, o caller deve tratar como "cache miss" e decidir
 * se reconcilia via refetch.
 */
export function applyRealtimePatch<T extends Record<string, any>>(
  current: T | null,
  payload: RealtimePayload<T>,
  deps: ReducerDeps,
): ApplyResult<T> {
  const id = String((payload.new?.id ?? payload.old?.id ?? "") as string);
  if (!id) return { next: current, changed: false };

  if (payload.eventType === "DELETE") {
    if (deps.isEcho(id)) return { next: current, changed: false };
    return { next: null, changed: current !== null };
  }

  const incoming = payload.new;
  if (!incoming) return { next: current, changed: false };

  // INSERT sem current: entra como é.
  if (!current) {
    return { next: incoming, changed: true };
  }

  // Descarta se o evento é mais antigo que o cache (fora de ordem)
  if (comparePrecedence(incoming as any, current as any) < 0) {
    return { next: current, changed: false };
  }

  // Dedupe de echo (sem field: bloqueia genericamente)
  if (deps.isEcho(id)) return { next: current, changed: false };

  const oldRow = (payload.old ?? {}) as Partial<T>;
  let next: T = current;
  let changed = false;

  const keys = new Set<string>([...Object.keys(oldRow), ...Object.keys(incoming)]);

  for (const key of keys) {
    const incomingVal = (incoming as any)[key];
    const currentVal = (current as any)[key];

    // Coleções aninhadas: merge por id
    if ((COLLECTION_FIELDS as readonly string[]).includes(key)) {
      const merged = mergeById(
        (currentVal as ColecaoItem[]) ?? [],
        (incomingVal as ColecaoItem[]) ?? [],
      );
      if (merged !== currentVal) {
        next = next === current ? { ...current } : next;
        (next as any)[key] = merged;
        changed = true;
      }
      continue;
    }

    // Campo editável travado: preserva local e empilha pendente
    if ((EDITABLE_FIELDS as readonly string[]).includes(key) && deps.isLocked(id, key)) {
      if (incomingVal !== currentVal) {
        deps.stashPending(id, key, incomingVal);
      }
      continue;
    }

    // Dedupe por campo (echo específico)
    if (deps.isEcho(id, key)) continue;

    // Aplica somente se realmente diferente
    if (!shallowEqual(incomingVal, currentVal)) {
      next = next === current ? { ...current } : next;
      (next as any)[key] = incomingVal;
      changed = true;
    }
  }

  return { next: changed ? next : current, changed };
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  // Objeto: comparação rasa
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (ao[k] !== bo[k]) return false;
  return true;
}
