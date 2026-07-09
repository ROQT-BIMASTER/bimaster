DO $$
DECLARE
  req_id bigint;
  svc text;
BEGIN
  SELECT decrypted_secret INTO svc FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||svc),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) INTO req_id;
  RAISE NOTICE 'req_id=%', req_id;
END $$;