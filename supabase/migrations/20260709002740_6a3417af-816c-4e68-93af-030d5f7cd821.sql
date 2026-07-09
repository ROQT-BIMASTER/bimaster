DO $$
DECLARE req_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public._get_cron_secret()
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) INTO req_id;
  RAISE NOTICE 'req_id=%', req_id;
END $$;