/**
 * draftRetry — retentativa com backoff exponencial para gravações
 * críticas de rascunho da Submissão China.
 *
 * Uso:
 *   const result = await saveDraftWithRetry(() => supabase.from(...).upsert(...));
 *   if (!result.ok) { toast.error(result.userMessage); ... }
 */
import { logger } from "@/lib/logger";

export interface DraftRetryOk<T> {
  ok: true;
  data: T;
  attempts: number;
}
export interface DraftRetryErr {
  ok: false;
  attempts: number;
  error: unknown;
  userMessage: string;
  technicalMessage: string;
}
export type DraftRetryResult<T> = DraftRetryOk<T> | DraftRetryErr;

export interface DraftRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  label?: string;
}

const NON_RETRYABLE = [
  "row-level security",
  "violates",
  "duplicate key",
  "permission denied",
  "not authenticated",
];

function isNonRetryable(message: string): boolean {
  const m = message.toLowerCase();
  return NON_RETRYABLE.some((kw) => m.includes(kw));
}

function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("row-level security") || m.includes("permission denied")) {
    return "Sem permissão para salvar o rascunho. Verifique seu acesso ao módulo Fábrica/China.";
  }
  if (m.includes("duplicate key")) {
    return "Já existe um rascunho com esses dados. Tente recarregar a página.";
  }
  if (m.includes("not authenticated") || m.includes("jwt") || m.includes("session")) {
    return "Sua sessão expirou. Faça login novamente para continuar.";
  }
  if (m.includes("network") || m.includes("failed to fetch") || m.includes("timeout")) {
    return "Falha de conexão ao salvar. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível salvar o rascunho automaticamente. Use o botão Salvar Rascunho.";
}

export async function saveDraftWithRetry<T>(
  fn: () => PromiseLike<{ data: T | null; error: any } | T>,
  opts: DraftRetryOptions = {},
): Promise<DraftRetryResult<T>> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 400;
  const label = opts.label ?? "draft";

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r: any = await fn();
      // Suporta tanto Supabase (objeto { data, error }) quanto retorno direto.
      if (r && typeof r === "object" && "error" in r) {
        if (r.error) {
          lastError = r.error;
          const msg = r.error.message || String(r.error);
          if (isNonRetryable(msg)) {
            return {
              ok: false,
              attempts: attempt,
              error: r.error,
              technicalMessage: msg,
              userMessage: translate(msg),
            };
          }
          logger.warn(`[${label}] tentativa ${attempt}/${maxAttempts} falhou:`, msg);
        } else {
          return { ok: true, data: r.data as T, attempts: attempt };
        }
      } else {
        return { ok: true, data: r as T, attempts: attempt };
      }
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || String(err);
      if (isNonRetryable(msg)) {
        return {
          ok: false,
          attempts: attempt,
          error: err,
          technicalMessage: msg,
          userMessage: translate(msg),
        };
      }
      logger.warn(`[${label}] exceção tentativa ${attempt}/${maxAttempts}:`, msg);
    }

    if (attempt < maxAttempts) {
      const delay = baseDelay * 2 ** (attempt - 1) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  const msg = lastError?.message || String(lastError ?? "unknown error");
  return {
    ok: false,
    attempts: maxAttempts,
    error: lastError,
    technicalMessage: msg,
    userMessage: translate(msg),
  };
}

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error";
