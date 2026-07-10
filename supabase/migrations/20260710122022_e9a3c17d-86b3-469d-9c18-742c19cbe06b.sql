DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ipaper-push-horario') THEN
    PERFORM cron.unschedule('ipaper-push-horario');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-estoque-live-pre-ipaper',
  '45 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public._get_cron_secret()
    ),
    body := '{"path":"sync-estoque-live"}'::jsonb
  );
  $$
);