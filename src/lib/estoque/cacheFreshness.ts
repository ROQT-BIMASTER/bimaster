import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

/**
 * Garantia de freshness compartilhada do `estoque_unificado_cache`.
 *
 * A partir do Item 2 da revisão estrutural, o refresh é feito por um job
 * server-side (pg_cron `refresh-estoque-unificado`, a cada 5 min). Este
 * helper NÃO dispara mais a RPC no hot path do cliente — apenas checa o
 * `MAX(atualizado_em)` do cache e, se estiver com mais de 10 min de idade
 * (indicando que o cron falhou), dispara a RPC como fallback.
 *
 * Chamadas concorrentes reaproveitam a mesma Promise em voo. Timeout de 5 s
 * na RPC de fallback; falhas são logadas e resolvem silenciosamente.
 */

const STALE_THRESHOLD_MS = 10 * 60_000; // 10 min
const MIN_CHECK_INTERVAL_MS = 25_000;    // não repetir o probe mais rápido que isso
const TIMEOUT_MS = 5_000;

let inflight: Promise<void> | null = null;
let lastCheckAt = 0;

async function isCacheStale(): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('estoque_unificado_cache')
    .select('atualizado_em')
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.warn('[cacheFreshness] probe atualizado_em falhou', { error });
    return false; // não sabemos → não força RPC
  }
  const iso = (data as { atualizado_em?: string } | null)?.atualizado_em;
  if (!iso) return true;
  const age = Date.now() - new Date(iso).getTime();
  return age > STALE_THRESHOLD_MS;
}

export function awaitCacheUnificadoFresh(): Promise<void> {
  const now = Date.now();
  if (inflight) return inflight;
  if (now - lastCheckAt < MIN_CHECK_INTERVAL_MS) return Promise.resolve();

  inflight = (async () => {
    try {
      const stale = await isCacheStale();
      if (!stale) return;
      logger.warn('[cacheFreshness] cache estale (>10min) — disparando fallback RPC');
      const rpcPromise = (supabase.rpc as any)('refresh_estoque_unificado_cache');
      const timeoutPromise = new Promise<void>((resolve) =>
        setTimeout(() => resolve(), TIMEOUT_MS),
      );
      await Promise.race([
        rpcPromise.then(
          () => undefined,
          (err: unknown) => {
            logger.warn('[cacheFreshness] fallback RPC falhou', { error: err });
          },
        ),
        timeoutPromise,
      ]);
    } finally {
      lastCheckAt = Date.now();
      inflight = null;
    }
  })();

  return inflight;
}
