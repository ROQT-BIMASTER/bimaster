import { useCallback, useRef } from "react";
import { toast } from "sonner";

/**
 * Hook de proteção DDoS no frontend.
 * Intercepta respostas 429 e aplica backoff exponencial.
 */
export function useDDoSProtection() {
  const backoffRef = useRef(1000);
  const blockedUntilRef = useRef<number | null>(null);

  const isBlocked = useCallback(() => {
    if (!blockedUntilRef.current) return false;
    if (Date.now() >= blockedUntilRef.current) {
      blockedUntilRef.current = null;
      backoffRef.current = 1000;
      return false;
    }
    return true;
  }, []);

  const handleRateLimitResponse = useCallback((retryAfter?: number) => {
    const waitSeconds = retryAfter || Math.ceil(backoffRef.current / 1000);
    blockedUntilRef.current = Date.now() + waitSeconds * 1000;
    backoffRef.current = Math.min(backoffRef.current * 2, 60000);

    toast.warning(`Muitas requisições. Aguarde ${waitSeconds}s antes de continuar.`, {
      id: "ddos-rate-limit",
      duration: waitSeconds * 1000,
    });
  }, []);

  const checkResponse = useCallback(
    (response: Response) => {
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "30");
        handleRateLimitResponse(retryAfter);
        return false; // blocked
      }
      return true; // allowed
    },
    [handleRateLimitResponse]
  );

  return { isBlocked, checkResponse, handleRateLimitResponse };
}
