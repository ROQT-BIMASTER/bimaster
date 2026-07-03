/**
 * Feature flags do módulo Tarefas (anti-flicker v3).
 *
 * Todas OFF por padrão: enquanto ninguém as ligar, o comportamento de
 * produção não muda. Cada flag protege uma fase da entrega e pode ser
 * desligada em runtime sem redeploy (kill-switch).
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
 *   3. Default: false
 *
 * A leitura via banco (`feature_flags`) fica para uma segunda rodada;
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

declare global {
  interface Window {
    __TAREFAS_FF__?: Partial<Record<TarefasFeatureFlag, boolean>>;
  }
}

/** Leitura síncrona da flag. Retorna `false` em SSR ou quando indefinida. */
export function isTarefasFlagEnabled(flag: TarefasFeatureFlag): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ls = window.localStorage?.getItem(LS_PREFIX + flag);
    if (ls === "on") return true;
    if (ls === "off") return false;
  } catch {
    // localStorage indisponível (modo privado, iframe sandboxed) — ignora
  }
  const injected = window.__TAREFAS_FF__?.[flag];
  if (typeof injected === "boolean") return injected;
  return false;
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
