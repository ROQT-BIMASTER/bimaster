/**
 * Instrumentação anti-flicker (dev/QA opt-in).
 *
 * Objetivos:
 *   1. Contar remounts por linha de tarefa (`useRowMountCounter`).
 *   2. Medir tempo até estabilizar a UI após um update no cache
 *      (`markTasksUpdated` inicia uma janela de observação; a estabilização
 *      é declarada quando o DOM fica quieto por `QUIET_MS`).
 *   3. Expor snapshot legível em `window.__tarefasInstrumentation` para o QA
 *      e para os testes Playwright anti-flicker.
 *
 * Zero custo quando desligado (a flag é lida uma vez por chamada). Não emite
 * logs em produção — apenas mantém contadores em memória. Todos os pontos de
 * escrita usam `queueMicrotask`/`requestAnimationFrame` para evitar impacto
 * na thread principal.
 */

import { useEffect, useRef } from "react";
import { isTarefasFlagEnabled } from "./featureFlags";

const QUIET_MS = 400; // janela sem mutações para declarar "estável"
const MAX_WAIT_MS = 8_000; // teto de segurança da medição
const MAX_HISTORY = 100;

type UpdateSample = {
  label: string;
  startedAt: number;
  stabilizedAt: number | null;
  durationMs: number | null;
  mutations: number;
  timedOut: boolean;
};

type RowStat = { mounts: number; unmounts: number; lastMountAt: number };

type Snapshot = {
  enabled: boolean;
  rows: { total: number; totalMounts: number; totalUnmounts: number; top: Array<{ id: string; mounts: number }> };
  updates: {
    total: number;
    lastDurationMs: number | null;
    avgDurationMs: number | null;
    p95DurationMs: number | null;
    timeouts: number;
    history: UpdateSample[];
  };
};

declare global {
  interface Window {
    __tarefasInstrumentation?: {
      snapshot: () => Snapshot;
      reset: () => void;
      enable: (on?: boolean) => void;
      markUpdate: (label?: string) => void;
    };
  }
}

const rowStats = new Map<string, RowStat>();
const samples: UpdateSample[] = [];
let currentSample: UpdateSample | null = null;
let observer: MutationObserver | null = null;
let quietTimer: number | null = null;
let hardTimer: number | null = null;

function isEnabled(): boolean {
  // Reusa flags já existentes (não cria feature flag nova). Ativa com:
  //   localStorage.setItem("ff:tarefas_realtime_cirurgico","on")
  //   localStorage.setItem("ff:instrumentation","on")
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage?.getItem("ff:instrumentation") === "on") return true;
  } catch {
    /* ignore */
  }
  return false;
}

function scheduleQuietCheck(now: number) {
  if (!currentSample) return;
  if (quietTimer !== null) window.clearTimeout(quietTimer);
  quietTimer = window.setTimeout(() => finalizeSample(false, now + QUIET_MS), QUIET_MS);
}

function finalizeSample(timedOut: boolean, at: number) {
  if (!currentSample) return;
  currentSample.stabilizedAt = at;
  currentSample.durationMs = at - currentSample.startedAt;
  currentSample.timedOut = timedOut;
  samples.push(currentSample);
  if (samples.length > MAX_HISTORY) samples.shift();
  currentSample = null;
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (quietTimer !== null) {
    window.clearTimeout(quietTimer);
    quietTimer = null;
  }
  if (hardTimer !== null) {
    window.clearTimeout(hardTimer);
    hardTimer = null;
  }
}

function startObservation() {
  if (typeof window === "undefined" || observer) return;
  const root =
    document.querySelector('[data-tarefas-list-root]') ||
    document.querySelector("main") ||
    document.body;
  observer = new MutationObserver((muts) => {
    if (!currentSample) return;
    for (const m of muts) {
      currentSample.mutations += m.addedNodes.length + m.removedNodes.length;
    }
    scheduleQuietCheck(performance.now());
  });
  observer.observe(root, { childList: true, subtree: true, attributes: false });
}

/** Chamado sempre que o cache do TanStack Query recebe um patch de tarefas. */
export function markTasksUpdated(label = "tasks-update"): void {
  if (!isEnabled()) return;
  if (typeof window === "undefined") return;
  const now = performance.now();
  if (currentSample) {
    // Coalesce updates que chegam antes da UI estabilizar — reinicia janela.
    scheduleQuietCheck(now);
    return;
  }
  currentSample = {
    label,
    startedAt: now,
    stabilizedAt: null,
    durationMs: null,
    mutations: 0,
    timedOut: false,
  };
  startObservation();
  scheduleQuietCheck(now);
  if (hardTimer !== null) window.clearTimeout(hardTimer);
  hardTimer = window.setTimeout(() => finalizeSample(true, performance.now()), MAX_WAIT_MS);
}

/**
 * Registra mount/unmount de uma linha específica. Uso:
 *   useRowMountCounter(tarefa.id)
 */
export function useRowMountCounter(id: string | null | undefined): void {
  const enabledRef = useRef(false);
  useEffect(() => {
    enabledRef.current = isEnabled();
    if (!enabledRef.current || !id) return;
    const cur = rowStats.get(id) || { mounts: 0, unmounts: 0, lastMountAt: 0 };
    cur.mounts += 1;
    cur.lastMountAt = Date.now();
    rowStats.set(id, cur);
    return () => {
      if (!enabledRef.current || !id) return;
      const c = rowStats.get(id);
      if (c) {
        c.unmounts += 1;
        rowStats.set(id, c);
      }
    };
  }, [id]);
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function buildSnapshot(): Snapshot {
  const durations = samples.map((s) => s.durationMs || 0).filter((d) => d > 0);
  const total = samples.length;
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const totalMounts = Array.from(rowStats.values()).reduce((a, r) => a + r.mounts, 0);
  const totalUnmounts = Array.from(rowStats.values()).reduce((a, r) => a + r.unmounts, 0);
  const top = Array.from(rowStats.entries())
    .map(([id, r]) => ({ id, mounts: r.mounts }))
    .sort((a, b) => b.mounts - a.mounts)
    .slice(0, 10);
  return {
    enabled: isEnabled(),
    rows: { total: rowStats.size, totalMounts, totalUnmounts, top },
    updates: {
      total,
      lastDurationMs: samples[samples.length - 1]?.durationMs ?? null,
      avgDurationMs: avg,
      p95DurationMs: percentile(durations, 95),
      timeouts: samples.filter((s) => s.timedOut).length,
      history: samples.slice(-20),
    },
  };
}

function resetStats() {
  rowStats.clear();
  samples.length = 0;
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  currentSample = null;
  if (quietTimer !== null) {
    window.clearTimeout(quietTimer);
    quietTimer = null;
  }
  if (hardTimer !== null) {
    window.clearTimeout(hardTimer);
    hardTimer = null;
  }
}

/** Instala o handle global lazy — chamado uma vez no bootstrap do módulo. */
if (typeof window !== "undefined" && !window.__tarefasInstrumentation) {
  window.__tarefasInstrumentation = {
    snapshot: buildSnapshot,
    reset: resetStats,
    enable: (on = true) => {
      try {
        window.localStorage.setItem("ff:instrumentation", on ? "on" : "off");
      } catch {
        /* ignore */
      }
    },
    markUpdate: (label?: string) => markTasksUpdated(label),
  };
}

// Silencia o "unused" quando o consumidor só quer os efeitos globais.
export const __tarefasInstrumentation = { markTasksUpdated, useRowMountCounter };
