-- PR-1B: Cron a cada 6h para limpar cache de idempotência expirado.
-- Usa pg_cron (já habilitado pelo PR-2). Idempotente: unschedule antes para evitar duplicatas.

DO $$
BEGIN
  -- Unschedule se já existir (idempotente)
  PERFORM cron.unschedule('cleanup-idempotency-cache')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-idempotency-cache');
EXCEPTION WHEN OTHERS THEN
  -- ignore se não existir
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup-idempotency-cache',
  '0 */6 * * *',  -- a cada 6h (00:00, 06:00, 12:00, 18:00 UTC)
  $$ SELECT public.cleanup_expired_idempotency_cache(); $$
);