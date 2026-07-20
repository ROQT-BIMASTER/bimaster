-- sync-estoque-erp-5h (full)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-estoque-erp-5h';
SELECT cron.schedule(
  'sync-estoque-erp-5h',
  '0 */5 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFva2t5cmdhcWphcmhseXdoamp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDA0MjYsImV4cCI6MjA3NDc3NjQyNn0.PlGQQyGUwOZKITqjdWyk-PXo0duk8s2TsKm8uJSZJ7s',
      'x-cron-secret', public._get_cron_secret()
    ),
    body := '{"path":"sync-estoque-full"}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);

-- sync-estoque-live-horario
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-estoque-live-horario';
SELECT cron.schedule(
  'sync-estoque-live-horario',
  '5 9-23 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFva2t5cmdhcWphcmhseXdoamp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDA0MjYsImV4cCI6MjA3NDc3NjQyNn0.PlGQQyGUwOZKITqjdWyk-PXo0duk8s2TsKm8uJSZJ7s',
      'x-cron-secret', public._get_cron_secret()
    ),
    body := '{"path":"sync-estoque-live"}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);

-- sync-estoque-live-pre-ipaper
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'sync-estoque-live-pre-ipaper';
SELECT cron.schedule(
  'sync-estoque-live-pre-ipaper',
  '45 10 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFva2t5cmdhcWphcmhseXdoamp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDA0MjYsImV4cCI6MjA3NDc3NjQyNn0.PlGQQyGUwOZKITqjdWyk-PXo0duk8s2TsKm8uJSZJ7s',
      'x-cron-secret', public._get_cron_secret()
    ),
    body := '{"path":"sync-estoque-live"}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);

-- Dispara agora para atualizar as fontes atrasadas
SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFva2t5cmdhcWphcmhseXdoamp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDA0MjYsImV4cCI6MjA3NDc3NjQyNn0.PlGQQyGUwOZKITqjdWyk-PXo0duk8s2TsKm8uJSZJ7s',
    'x-cron-secret', public._get_cron_secret()
  ),
  body := '{"path":"sync-estoque-full"}'::jsonb,
  timeout_milliseconds := 300000
);
SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFva2t5cmdhcWphcmhseXdoamp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMDA0MjYsImV4cCI6MjA3NDc3NjQyNn0.PlGQQyGUwOZKITqjdWyk-PXo0duk8s2TsKm8uJSZJ7s',
    'x-cron-secret', public._get_cron_secret()
  ),
  body := '{"path":"sync-estoque-live"}'::jsonb,
  timeout_milliseconds := 300000
);