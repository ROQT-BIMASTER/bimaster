DO $$
DECLARE
  req_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret', public._get_cron_secret(),
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFva2t5cmdhcWphcmhseXdoamp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDA0MjYsImV4cCI6MjA3NDc3NjQyNn0.PlGQQyGUwOZKITqjdWyk-PXo0duk8s2TsKm8uJSZJ7s'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) INTO req_id;
  RAISE NOTICE 'req_id=%', req_id;
END $$;