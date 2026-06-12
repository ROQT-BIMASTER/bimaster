import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Garantia de freshness compartilhada do `estoque_unificado_cache`.
 *
 * - Dispara `refresh_estoque_unificado_cache` no máximo uma vez a cada 25 s.
 * - Chamadas concorrentes recebem a mesma Promise em voo (singleton in-flight),
 *   para que os 3 consumidores (Unificado, Cores KPI, Conciliação) leiam o
 *   mesmo snapshot do cache dentro do ciclo de 30 s.
 * - Timeout interno de 5 s; falhas são logadas e resolvem silenciosamente.
 */

const MIN_INTERVAL_MS = 25_000;
const TIMEOUT_MS = 5_000;

let inflight: Promise<void> | null = null;
let lastRefreshAt = 0;

export function awaitCacheUnificadoFresh(): Promise<void> {
  const now = Date.now();
  if (inflight) return inflight;
  if (now - lastRefreshAt < MIN_INTERVAL_MS) return Promise.resolve();

  const rpcPromise = (supabase.rpc as any)('refresh_estoque_unificado_cache');
  const timeoutPromise = new Promise<void>((resolve) =>
    setTimeout(() => resolve(), TIMEOUT_MS),
  );

  inflight = Promise.race([
    rpcPromise.then(
      () => undefined,
      (err: unknown) => {
        logger.warn('[cacheFreshness] refresh_estoque_unificado_cache falhou', { error: err });
      },
    ),
    timeoutPromise,
  ]).then(() => {
    lastRefreshAt = Date.now();
    inflight = null;
  });

  return inflight;
}
