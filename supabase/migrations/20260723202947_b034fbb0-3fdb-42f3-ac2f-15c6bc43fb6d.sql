
-- 1) Remover TODOS os jobs que disparam consulta ao ERP do Result
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('sync-estoque-live-horario', 'ipaper-push-horario')
       OR command ILIKE '%erp-sync-engine%'
       OR command ILIKE '%cron-estoque-trigger%'
       OR command ILIKE '%ipaper-push%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

-- Defensive unschedule por nome (idempotência)
DO $$
DECLARE n text;
BEGIN
  FOR n IN SELECT unnest(ARRAY[
    'sync-estoque-janela-manha',
    'sync-estoque-janela-almoco',
    'sync-estoque-janela-noite',
    'sync-composicao-janela-noite',
    'ipaper-push-janela-manha',
    'ipaper-push-janela-almoco',
    'ipaper-push-janela-noite'
  ]) LOOP
    PERFORM cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = n;
  END LOOP;
END $$;

-- 2) Recriar as janelas (todos horários em UTC; pg_cron agenda em UTC)

-- Estoque completo (sync-estoque-full já executa sync-estoque-live no final)
SELECT cron.schedule('sync-estoque-janela-manha', '30 8 * * *',
$$SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', public._get_cron_secret()),
  body := '{"path":"sync-estoque-full"}'::jsonb);$$);

SELECT cron.schedule('sync-estoque-janela-almoco', '10 15 * * *',
$$SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', public._get_cron_secret()),
  body := '{"path":"sync-estoque-full"}'::jsonb);$$);

SELECT cron.schedule('sync-estoque-janela-noite', '30 0 * * *',
$$SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', public._get_cron_secret()),
  body := '{"path":"sync-estoque-full"}'::jsonb);$$);

-- Composição/BOM: 1x/dia na janela da noite
SELECT cron.schedule('sync-composicao-janela-noite', '40 0 * * *',
$$SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', public._get_cron_secret()),
  body := '{"path":"sync-composicao-full"}'::jsonb);$$);

-- Push do catálogo iPaper: ~30 min após cada janela de estoque
SELECT cron.schedule('ipaper-push-janela-manha', '0 9 * * *',
$$SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', public._get_cron_secret()),
  body := '{}'::jsonb);$$);

SELECT cron.schedule('ipaper-push-janela-almoco', '40 15 * * *',
$$SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', public._get_cron_secret()),
  body := '{}'::jsonb);$$);

SELECT cron.schedule('ipaper-push-janela-noite', '0 1 * * *',
$$SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', public._get_cron_secret()),
  body := '{}'::jsonb);$$);
