/**
 * Feature flags do módulo Tarefas (anti-flicker v3).
 *
 * Anti-flicker ligado por padrão: o usuário final já recebe patch granular,
 * batch e proteção de edição sem precisar configurar DevTools. Cada flag pode
 * ser desligada em runtime sem redeploy (kill-switch).
 *
 * Ordem sugerida de rollout (mesma ordem para rollback, inversa):
 *   1. tarefas_realtime_cirurgico      — reducer + patch granular
 *   2. tarefas_realtime_batch          — coalescing em RAF
 *   3. tarefas_realtime_dedupe         — descarta echo próprio
 *   4. tarefas_descricao_editor_isolado — editor local com toggle M1/M2
 *   5. tarefas_drawer_permanente       — drawer sempre montado
 *
 * Fonte da flag (nesta ordem de precedência):
 *   1. `localStorage["ff:<flag>"]` = `"on" | "off"` (override dev/QA)
 *   2. `window.__TAREFAS_FF__[<flag>]` (injetado por script/E2E)
 *   3. Default: true para as proteções anti-flicker de tarefas
 *
 * A leitura via backend (`feature_flags`) fica para uma segunda rodada;
 * este helper é intencionalmente síncrono e sem I/O para não introduzir
 * loading state em componentes.
 */

export type TarefasFeatureFlag =
  | "tarefas_realtime_cirurgico"
  | "tarefas_realtime_batch"
  | "tarefas_realtime_dedupe"
  | "tarefas_descricao_editor_isolado"
  | "tarefas_drawer_permanente";

const LS_PREFIX = "ff:";

const DEFAULT_FLAGS: Record<TarefasFeatureFlag, boolean> = {
  tarefas_realtime_cirurgico: true,
  tarefas_realtime_batch: true,
  tarefas_realtime_dedupe: true,
  tarefas_descricao_editor_isolado: true,
  tarefas_drawer_permanente: true,
};

declare global {
  interface Window {
    __TAREFAS_FF__?: Partial<Record<TarefasFeatureFlag, boolean>>;
  }
}

/** Leitura síncrona da flag. Em SSR retorna o default seguro da flag. */
export function isTarefasFlagEnabled(flag: TarefasFeatureFlag): boolean {
  const defaultValue = DEFAULT_FLAGS[flag] ?? false;
  if (typeof window === "undefined") return defaultValue;
  try {
    const ls = window.localStorage?.getItem(LS_PREFIX + flag);
    if (ls === "on") return true;
    if (ls === "off") return false;
  } catch {
    // localStorage indisponível (modo privado, iframe sandboxed) — ignora
  }
  const injected = window.__TAREFAS_FF__?.[flag];
  if (typeof injected === "boolean") return injected;
  return defaultValue;
}

/** Override runtime (útil em dev tools, Storybook, testes E2E). */
export function setTarefasFlag(flag: TarefasFeatureFlag, value: boolean | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) {
      window.localStorage.removeItem(LS_PREFIX + flag);
    } else {
      window.localStorage.setItem(LS_PREFIX + flag, value ? "on" : "off");
    }
  } catch {
    /* noop */
  }
}
