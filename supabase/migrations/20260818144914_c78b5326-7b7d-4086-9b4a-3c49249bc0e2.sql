SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/admin-align-storage-buckets',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', public._get_cron_secret()),
  body := '{}'::jsonb
);