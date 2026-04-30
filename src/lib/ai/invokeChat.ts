/**
 * invokeChat — wrapper de supabase.functions.invoke para chats de IA.
 *
 * Por que existe:
 *  - `supabase.functions.invoke()` NÃO tem timeout no cliente. Se a edge
 *    function trava, o spinner roda para sempre.
 *  - Padroniza tradução de erros 402/429/timeout em mensagens claras
 *    para toast.
 *
 * Uso:
 *   const { data, error } = await invokeChat("ai-insights", { message });
 *   if (error) { toast.error(error.userMessage); return; }
 */
import { supabase } from "@/integrations/supabase/client";

export type InvokeChatError = {
  code: "TIMEOUT" | "PAYMENT_REQUIRED" | "RATE_LIMITED" | "UNAUTHORIZED" | "UPSTREAM" | "UNKNOWN";
  userMessage: string;
  raw?: unknown;
};

export interface InvokeChatOptions {
  /** Timeout em ms. Default 90s — gateway costuma responder em <30s. */
  timeoutMs?: number;
  /** Headers extras (ex.: Authorization explícito). */
  headers?: Record<string, string>;
}

export async function invokeChat<T = any>(
  functionName: string,
  body: Record<string, unknown>,
  opts: InvokeChatOptions = {}
): Promise<{ data: T | null; error: InvokeChatError | null }> {
  const timeoutMs = opts.timeoutMs ?? 90_000;

  const timeoutPromise = new Promise<{ data: null; error: InvokeChatError }>((resolve) =>
    setTimeout(() => {
      resolve({
        data: null,
        error: {
          code: "TIMEOUT",
          userMessage:
            "O assistente demorou demais para responder. Tente reformular sua pergunta de forma mais simples.",
        },
      });
    }, timeoutMs)
  );

  const invokePromise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
        headers: opts.headers,
      });

      if (error) {
        const status =
          (error as any)?.context?.status ??
          (typeof (error as any)?.message === "string" &&
            (error as any).message.match(/\b(4\d\d|5\d\d)\b/)?.[0]);

        if (status === 402 || `${(error as any)?.message ?? ""}`.includes("402")) {
          return {
            data: null,
            error: {
              code: "PAYMENT_REQUIRED" as const,
              userMessage:
                "Créditos de IA esgotados. Adicione créditos no workspace para continuar.",
              raw: error,
            },
          };
        }
        if (status === 429 || `${(error as any)?.message ?? ""}`.includes("429")) {
          return {
            data: null,
            error: {
              code: "RATE_LIMITED" as const,
              userMessage:
                "Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.",
              raw: error,
            },
          };
        }
        if (status === 401 || status === 403) {
          return {
            data: null,
            error: {
              code: "UNAUTHORIZED" as const,
              userMessage: "Sessão expirada. Faça login novamente.",
              raw: error,
            },
          };
        }
        return {
          data: null,
          error: {
            code: "UPSTREAM" as const,
            userMessage:
              (error as any)?.message ?? "Erro ao conversar com o assistente. Tente novamente.",
            raw: error,
          },
        };
      }

      return { data: (data as T) ?? null, error: null };
    } catch (e: any) {
      return {
        data: null,
        error: {
          code: "UNKNOWN" as const,
          userMessage: e?.message ?? "Erro inesperado ao chamar o assistente.",
          raw: e,
        },
      };
    }
  })();

  return (await Promise.race([invokePromise, timeoutPromise])) as {
    data: T | null;
    error: InvokeChatError | null;
  };
}
