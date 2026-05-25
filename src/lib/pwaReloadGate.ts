/**
 * PWA Reload Gate
 *
 * Quando uma UI sensível está aberta (ex.: drawer de detalhe de tarefa), os
 * consumidores chamam `acquireReloadGate()` ao montar e
 * `releaseReloadGate()` ao desmontar. Enquanto o gate está ativo, o
 * `PWAContext` adia o `window.location.reload()` disparado por
 * `controllerchange` do Service Worker — evita perder o contexto em que o
 * usuário está editando quando volta de outra aba.
 *
 * Quando o contador chega a zero, dispara o evento `pwa-reload-gate-clear`
 * para que o reload pendente possa executar imediatamente.
 */

const EVENT_CLEAR = "pwa-reload-gate-clear";
const ATTR = "data-reload-gate";

let count = 0;

function sync() {
  if (typeof document === "undefined") return;
  if (count > 0) document.body.setAttribute(ATTR, String(count));
  else document.body.removeAttribute(ATTR);
}

export function acquireReloadGate(): void {
  count++;
  sync();
}

export function releaseReloadGate(): void {
  count = Math.max(0, count - 1);
  sync();
  if (count === 0 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT_CLEAR));
  }
}

export function isReloadGateActive(): boolean {
  return count > 0;
}

export function onReloadGateClear(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_CLEAR, cb);
  return () => window.removeEventListener(EVENT_CLEAR, cb);
}
