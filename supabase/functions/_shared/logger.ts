// supabase/functions/_shared/logger.ts
//
// Logger estruturado para Edge Functions.
//
// Em produção (default): silencia debug/info; warn/error vão para console.
// Em DEV (DENO_ENV=development): tudo imprime.
//
// Drop-in replacement do `console.*`:
//   import { logger } from "../_shared/logger.ts";
//   logger.log("foo", x);   // = console.log
//   logger.info(...);
//   logger.warn(...);
//   logger.error(...);
//   logger.debug(...);
//
// API estruturada (preferível para código novo):
//   logger.event("info", "user_signed_in", { userId, action: "sign_in" });

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function getMinLevel(): Level {
  const env = (globalThis as any).Deno?.env?.get?.("DENO_ENV") ?? "production";
  if (env === "development" || env === "dev") return "debug";
  const override = (globalThis as any).Deno?.env?.get?.("LOG_LEVEL") as Level | undefined;
  if (override && override in LEVELS) return override;
  return "warn"; // produção: só warn/error por default
}

const MIN = LEVELS[getMinLevel()];

function shouldLog(level: Level): boolean {
  return LEVELS[level] >= MIN;
}

function emit(level: Level, args: unknown[]) {
  if (!shouldLog(level)) return;
  const fn = level === "error" ? console.error
    : level === "warn" ? console.warn
    : level === "info" ? console.info
    : console.log;
  fn(...args);
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  log: (...args: unknown[]) => emit("info", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
  /**
   * Evento estruturado. Sempre vai para o console como JSON em uma linha,
   * facilitando ingestão por coletores (Logflare, Datadog, etc.).
   */
  event(level: Level, event: string, meta?: Record<string, unknown>) {
    if (!shouldLog(level)) return;
    const payload = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(meta ?? {}) });
    emit(level, [payload]);
  },
};
