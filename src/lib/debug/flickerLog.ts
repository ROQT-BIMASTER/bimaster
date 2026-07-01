/**
 * Instrumentação temporária para diagnosticar piscadas ao criar subtarefas.
 *
 * Ativar no console:
 *   localStorage.setItem("debug_flicker", "1"); location.reload();
 *
 * Após reproduzir o problema, copiar o trace:
 *   copy(window.__flickerTrace)
 *
 * Desativar:
 *   localStorage.removeItem("debug_flicker"); location.reload();
 */

type FlickerEntry = {
  t: number;
  delta: number;
  phase: string;
  data?: Record<string, unknown>;
};

declare global {
  interface Window {
    __flickerTrace?: FlickerEntry[];
    __flickerLast?: number;
    __flickerObserver?: MutationObserver;
    dumpFlickerTrace?: () => FlickerEntry[];
    resetFlickerTrace?: () => void;
  }
}

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("debug_flicker") === "1";
  } catch {
    return false;
  }
}

export function flickerLog(phase: string, data?: Record<string, unknown>): void {
  if (!isEnabled()) return;
  const t = performance.now();
  const last = window.__flickerLast ?? t;
  const delta = +(t - last).toFixed(2);
  window.__flickerLast = t;
  const entry: FlickerEntry = { t: +t.toFixed(2), delta, phase, data };
  if (!window.__flickerTrace) window.__flickerTrace = [];
  window.__flickerTrace.push(entry);
  // eslint-disable-next-line no-console
  console.log(
    `%c[flicker +${delta}ms] ${phase}`,
    "color:#E91E78;font-weight:bold",
    data ?? "",
  );
}

export function resetFlickerTrace(): void {
  if (typeof window === "undefined") return;
  window.__flickerTrace = [];
  window.__flickerLast = performance.now();
  // eslint-disable-next-line no-console
  console.log("%c[flicker] trace reset", "color:#E91E78");
}

export function installFlickerDomObserver(): void {
  if (!isEnabled() || typeof window === "undefined") return;
  if (window.__flickerObserver) return;
  const target = document.body;
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const targetEl = m.target as HTMLElement;
      // Filtrar só o que está dentro do drawer de tarefa
      const drawer = targetEl?.closest?.('[role="dialog"], [data-tarefa-drawer]');
      if (!drawer) continue;
      flickerLog("dom-mutation", {
        type: m.type,
        attr: m.attributeName ?? null,
        added: m.addedNodes.length,
        removed: m.removedNodes.length,
        tag: (targetEl?.tagName ?? "").toLowerCase(),
      });
    }
  });
  obs.observe(target, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-state", "style", "class"],
  });
  window.__flickerObserver = obs;
  flickerLog("dom-observer-installed");
}

if (typeof window !== "undefined") {
  window.dumpFlickerTrace = () => window.__flickerTrace ?? [];
  window.resetFlickerTrace = resetFlickerTrace;
  // Auto-instala observer se flag ativa
  if (isEnabled()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", installFlickerDomObserver);
    } else {
      installFlickerDomObserver();
    }
  }
}
