-- Sincroniza vault.cron_secret com CRON_SECRET das Edge Functions
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_secret' LIMIT 1;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret('F8ktdmdxb1ZF52xsByJeI2-MoX5qceHZA8B9TF3c7pK2t5zG5EPr4XdMBV0CFbby', 'cron_secret', 'Shared secret for pg_cron → Edge Functions');
  ELSE
    PERFORM vault.update_secret(v_id, 'F8ktdmdxb1ZF52xsByJeI2-MoX5qceHZA8B9TF3c7pK2t5zG5EPr4XdMBV0CFbby');
  END IF;
END $$;

-- Reagenda o cron de estoque completo (jobid 277 estava active=true mas sem execuções nas últimas 48h)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-estoque-erp-5h';
SELECT cron.schedule(
  'sync-estoque-erp-5h',
  '0 */5 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', public._get_cron_secret()
    ),
    body := '{"path":"sync-estoque-full"}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);