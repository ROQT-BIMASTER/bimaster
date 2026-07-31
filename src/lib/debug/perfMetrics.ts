/**
 * Métricas de performance do drawer de tarefas (renderizações e anexos).
 *
 * Ativar no console do navegador:
 *   localStorage.setItem("debug_perf", "1"); location.reload();
 *
 * Consultar:
 *   dumpPerfReport()        // tabela agregada por componente/operação
 *   window.__perfTrace      // eventos brutos
 *   resetPerfMetrics()
 *
 * Desativar:
 *   localStorage.removeItem("debug_perf"); location.reload();
 *
 * Em desenvolvimento (import.meta.env.DEV) a coleta fica sempre ativa em
 * memória; os logs no console só aparecem com a flag acima.
 */

export type PerfEvent = {
  t: number;
  kind: "render" | "duplicate-render" | "async" | "mark";
  label: string;
  durationMs?: number;
  data?: Record<string, unknown>;
};

export type RenderStat = {
  label: string;
  renders: number;
  duplicates: number;
  lastRenderAt: number;
  changedPropsTop: Record<string, number>;
};

export type AsyncStat = {
  label: string;
  calls: number;
  totalMs: number;
  maxMs: number;
  errors: number;
};

declare global {
  interface Window {
    __perfTrace?: PerfEvent[];
    __perfRenderStats?: Record<string, RenderStat>;
    __perfAsyncStats?: Record<string, AsyncStat>;
    dumpPerfReport?: () => { renders: RenderStat[]; async: AsyncStat[] };
    resetPerfMetrics?: () => void;
  }
}

/** Renderizações idênticas dentro desta janela são consideradas duplicadas. */
const DUPLICATE_WINDOW_MS = 50;
const MAX_TRACE = 1000;

let verboseCache: boolean | null = null;

/** Log no console (flag explícita). */
export function isPerfVerbose(): boolean {
  if (typeof window === "undefined") return false;
  if (verboseCache !== null) return verboseCache;
  try {
    verboseCache = window.localStorage.getItem("debug_perf") === "1";
  } catch {
    verboseCache = false;
  }
  return verboseCache;
}

/** Coleta em memória (sempre ligada em dev, opt-in em produção). */
export function isPerfEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(import.meta.env?.DEV) || isPerfVerbose();
}

function pushEvent(evt: PerfEvent): void {
  if (!window.__perfTrace) window.__perfTrace = [];
  window.__perfTrace.push(evt);
  if (window.__perfTrace.length > MAX_TRACE) {
    window.__perfTrace.splice(0, window.__perfTrace.length - MAX_TRACE);
  }
}

function renderStats(): Record<string, RenderStat> {
  if (!window.__perfRenderStats) window.__perfRenderStats = {};
  return window.__perfRenderStats;
}

function asyncStats(): Record<string, AsyncStat> {
  if (!window.__perfAsyncStats) window.__perfAsyncStats = {};
  return window.__perfAsyncStats;
}

/** Registra uma renderização e devolve as chaves de props que mudaram. */
export function recordRender(
  label: string,
  signature: Record<string, unknown>,
  previous?: Record<string, unknown>,
): { duplicate: boolean; changed: string[]; count: number } {
  if (!isPerfEnabled()) return { duplicate: false, changed: [], count: 0 };

  const now = performance.now();
  const stats = renderStats();
  const stat =
    stats[label] ??
    (stats[label] = { label, renders: 0, duplicates: 0, lastRenderAt: 0, changedPropsTop: {} });

  const changed: string[] = [];
  if (previous) {
    for (const key of new Set([...Object.keys(signature), ...Object.keys(previous)])) {
      if (!Object.is(signature[key], previous[key])) changed.push(key);
    }
  }

  const duplicate =
    stat.renders > 0 && changed.length === 0 && now - stat.lastRenderAt < DUPLICATE_WINDOW_MS;

  stat.renders += 1;
  stat.lastRenderAt = now;
  if (duplicate) stat.duplicates += 1;
  for (const key of changed) {
    stat.changedPropsTop[key] = (stat.changedPropsTop[key] ?? 0) + 1;
  }

  pushEvent({
    t: +now.toFixed(2),
    kind: duplicate ? "duplicate-render" : "render",
    label,
    data: { changed, renders: stat.renders, ...signature },
  });

  if (isPerfVerbose() && duplicate) {
    // eslint-disable-next-line no-console
    console.warn(
      `%c[perf] render duplicado: ${label} (#${stat.renders})`,
      "color:#E91E78;font-weight:bold",
      signature,
    );
  }

  return { duplicate, changed, count: stat.renders };
}

/** Marca pontual (abertura/fechamento do drawer, troca de tarefa, etc.). */
export function perfMark(label: string, data?: Record<string, unknown>): void {
  if (!isPerfEnabled()) return;
  const now = performance.now();
  try {
    performance.mark(`perf:${label}`);
  } catch {
    /* noop */
  }
  pushEvent({ t: +now.toFixed(2), kind: "mark", label, data });
  if (isPerfVerbose()) {
    // eslint-disable-next-line no-console
    console.log(`%c[perf] ${label}`, "color:#0ea5e9;font-weight:bold", data ?? "");
  }
}

function recordAsync(label: string, durationMs: number, ok: boolean, data?: Record<string, unknown>) {
  const stats = asyncStats();
  const stat =
    stats[label] ?? (stats[label] = { label, calls: 0, totalMs: 0, maxMs: 0, errors: 0 });
  stat.calls += 1;
  stat.totalMs += durationMs;
  stat.maxMs = Math.max(stat.maxMs, durationMs);
  if (!ok) stat.errors += 1;

  pushEvent({
    t: +performance.now().toFixed(2),
    kind: "async",
    label,
    durationMs: +durationMs.toFixed(2),
    data: { ok, ...data },
  });

  if (isPerfVerbose()) {
    // eslint-disable-next-line no-console
    console.log(
      `%c[perf] ${label} ${durationMs.toFixed(1)}ms${ok ? "" : " (erro)"}`,
      "color:#16a34a;font-weight:bold",
      data ?? "",
    );
  }
}

/** Mede uma operação assíncrona (assinatura de URL, download, render de PDF). */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
  data?: Record<string, unknown>,
): Promise<T> {
  if (!isPerfEnabled()) return fn();
  const start = performance.now();
  try {
    const result = await fn();
    recordAsync(label, performance.now() - start, true, data);
    return result;
  } catch (e) {
    recordAsync(label, performance.now() - start, false, data);
    throw e;
  }
}

/** Cronômetro manual: `const stop = startTimer("x"); ... stop();` */
export function startTimer(label: string, data?: Record<string, unknown>): (extra?: Record<string, unknown>) => void {
  if (!isPerfEnabled()) return () => undefined;
  const start = performance.now();
  let done = false;
  return (extra) => {
    if (done) return;
    done = true;
    recordAsync(label, performance.now() - start, true, { ...data, ...extra });
  };
}

export function dumpPerfReport(): { renders: RenderStat[]; async: AsyncStat[] } {
  const renders = Object.values(renderStats()).sort((a, b) => b.renders - a.renders);
  const asyncs = Object.values(asyncStats()).sort((a, b) => b.totalMs - a.totalMs);
  // eslint-disable-next-line no-console
  console.table(
    renders.map((r) => ({
      componente: r.label,
      renders: r.renders,
      duplicados: r.duplicates,
      "props que mais mudam": Object.entries(r.changedPropsTop)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}(${v})`)
        .join(", "),
    })),
  );
  // eslint-disable-next-line no-console
  console.table(
    asyncs.map((a) => ({
      operacao: a.label,
      chamadas: a.calls,
      "media (ms)": +(a.totalMs / Math.max(a.calls, 1)).toFixed(1),
      "max (ms)": +a.maxMs.toFixed(1),
      erros: a.errors,
    })),
  );
  return { renders, async: asyncs };
}

export function resetPerfMetrics(): void {
  if (typeof window === "undefined") return;
  window.__perfTrace = [];
  window.__perfRenderStats = {};
  window.__perfAsyncStats = {};
}

if (typeof window !== "undefined") {
  window.dumpPerfReport = dumpPerfReport;
  window.resetPerfMetrics = resetPerfMetrics;
}
