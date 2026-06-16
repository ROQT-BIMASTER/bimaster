
-- 1) Função SECURITY DEFINER para ler o cron secret do Vault
CREATE OR REPLACE FUNCTION public._get_cron_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $function$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public._get_cron_secret() FROM PUBLIC, anon, authenticated;

-- 2) Reagendar job 100 (sync-cp-incremental) usando x-cron-secret
SELECT cron.unschedule('sync-cp-incremental');
SELECT cron.schedule(
  'sync-cp-incremental',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public._get_cron_secret()
    ),
    body := '{"path":"sync-contas-pagar","mode":"incremental"}'::jsonb
  );
  $$
);

-- 3) Reagendar job 101 (sync-cp-full-noturno) usando x-cron-secret
SELECT cron.unschedule('sync-cp-full-noturno');
SELECT cron.schedule(
  'sync-cp-full-noturno',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public._get_cron_secret()
    ),
    body := '{"path":"sync-contas-pagar","mode":"full"}'::jsonb
  );
  $$
);
