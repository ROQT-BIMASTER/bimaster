/**
 * thumbUrlCache
 * ------------------------------------------------------------------
 * Cache local de URLs assinadas de miniaturas (Kanban e demais listas).
 *
 * Objetivo: ao rolar o quadro, uma miniatura já resolvida não deve gerar
 * nova requisição de assinatura ao backend.
 *
 * Camadas:
 *  1. Memória (Map) — instantâneo, sobrevive a desmontagem de componentes.
 *  2. sessionStorage — sobrevive a troca de rota e reload da aba.
 *
 * As entradas guardam o instante de expiração e são descartadas com
 * margem de segurança antes do vencimento da URL assinada.
 */

const STORAGE_KEY = "thumb-url-cache:v1";
/** Margem antes do vencimento real da URL assinada. */
const MARGEM_MS = 5 * 60 * 1000;
/** Teto de entradas mantidas em sessionStorage (evita estourar a cota). */
const MAX_ENTRADAS = 400;

interface Entrada {
  url: string;
  /** Epoch em ms a partir do qual a entrada deixa de ser reaproveitada. */
  exp: number;
}

const memoria = new Map<string, Entrada>();
let hidratado = false;

export function thumbCacheKey(bucket: string, path: string): string {
  return `${bucket}::${path}`;
}

function lerSessao(): Record<string, Entrada> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Entrada>) : {};
  } catch {
    return {};
  }
}

function hidratar() {
  if (hidratado || typeof sessionStorage === "undefined") return;
  hidratado = true;
  const agora = Date.now();
  for (const [k, v] of Object.entries(lerSessao())) {
    if (v && typeof v.url === "string" && v.exp > agora) memoria.set(k, v);
  }
}

function persistir() {
  if (typeof sessionStorage === "undefined") return;
  try {
    const agora = Date.now();
    const validas = Array.from(memoria.entries())
      .filter(([, v]) => v.exp > agora)
      .slice(-MAX_ENTRADAS);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(validas)));
  } catch {
    // Cota cheia ou storage indisponível: cache em memória continua valendo.
  }
}

/** Retorna a URL assinada em cache, ou null se ausente/expirada. */
export function getThumbUrlCache(bucket: string, path: string): string | null {
  hidratar();
  const k = thumbCacheKey(bucket, path);
  const entrada = memoria.get(k);
  if (!entrada) return null;
  if (entrada.exp <= Date.now()) {
    memoria.delete(k);
    return null;
  }
  return entrada.url;
}

/**
 * Grava a URL assinada no cache.
 * @param ttlMs validade total da URL assinada (default: 1h, padrão do storage).
 */
export function setThumbUrlCache(bucket: string, path: string, url: string, ttlMs = 60 * 60 * 1000) {
  hidratar();
  if (!url) return;
  const exp = Date.now() + Math.max(ttlMs - MARGEM_MS, 60_000);
  memoria.set(thumbCacheKey(bucket, path), { url, exp });
  persistir();
}

/** Limpa o cache (usado em logout/troca de conta e nos testes). */
export function clearThumbUrlCache() {
  memoria.clear();
  hidratado = false;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
