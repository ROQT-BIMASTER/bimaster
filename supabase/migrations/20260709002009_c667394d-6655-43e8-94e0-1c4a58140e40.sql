DO $$
DECLARE
  req_id bigint;
  cron_secret text;
BEGIN
  SELECT decrypted_secret INTO cron_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) INTO req_id;
  RAISE NOTICE 'req_id=% cron_len=%', req_id, length(cron_secret);
END $$;