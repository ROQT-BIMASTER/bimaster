/**
 * Marca local (por navegador) de quais itens da Vincular China-Brasil já foram
 * abertos pelo usuário. Mantém o mesmo padrão "lido / não lido" visual da Caixa
 * de Entrada China sem exigir backend.
 */
const STORAGE_KEY = "china:vincular:read:v1";

type ReadSet = Set<string>;

function load(): ReadSet {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function save(set: ReadSet) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* noop */
  }
}

let cache: ReadSet | null = null;
const listeners = new Set<() => void>();

function getCache(): ReadSet {
  if (!cache) cache = load();
  return cache!;
}

export function isVincularRead(id: string): boolean {
  return getCache().has(id);
}

export function markVincularRead(id: string) {
  const c = getCache();
  if (c.has(id)) return;
  c.add(id);
  save(c);
  listeners.forEach((l) => l());
}

export function markAllVincularRead(ids: string[]) {
  const c = getCache();
  let changed = false;
  for (const id of ids) {
    if (!c.has(id)) { c.add(id); changed = true; }
  }
  if (!changed) return;
  save(c);
  listeners.forEach((l) => l());
}

export function clearVincularRead() {
  const c = getCache();
  if (c.size === 0) return;
  c.clear();
  save(c);
  listeners.forEach((l) => l());
}

export function subscribeVincularRead(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
