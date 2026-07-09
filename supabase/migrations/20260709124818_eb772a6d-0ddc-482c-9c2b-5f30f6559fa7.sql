SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', public._get_cron_secret()
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 180000
) AS req_id;