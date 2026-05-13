import { useSyncExternalStore } from "react";

/**
 * Hook seguro para obter o pathname atual sem depender de <Router>.
 *
 * Estratégia:
 * - Singleton: history.pushState/replaceState são instrumentados UMA vez no
 *   módulo, disparando um CustomEvent("locationchange"). Não restauramos o
 *   original — múltiplos consumidores conviveriam mal com restauração.
 * - useSyncExternalStore garante leitura consistente entre SSR/CSR e durante
 *   transições concorrentes do React 18.
 */

const EVENT = "app:locationchange";

let patched = false;
function ensurePatched() {
  if (patched || typeof window === "undefined") return;
  patched = true;

  const fire = () => window.dispatchEvent(new Event(EVENT));

  const origPush = window.history.pushState.bind(window.history);
  const origReplace = window.history.replaceState.bind(window.history);

  window.history.pushState = (...args: Parameters<typeof origPush>) => {
    const r = origPush(...args);
    fire();
    return r;
  };
  window.history.replaceState = (...args: Parameters<typeof origReplace>) => {
    const r = origReplace(...args);
    fire();
    return r;
  };

  window.addEventListener("popstate", fire);
  window.addEventListener("hashchange", fire);
}

function subscribe(cb: () => void) {
  ensurePatched();
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function getSnapshot() {
  return typeof window !== "undefined" ? window.location.pathname : "/";
}

function getServerSnapshot() {
  return "/";
}

export function useBrowserPathname() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
