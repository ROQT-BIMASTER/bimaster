DO $$
DECLARE
  req_id bigint;
  resp record;
  svc text;
BEGIN
  SELECT decrypted_secret INTO svc FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||svc),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) INTO req_id;
  PERFORM pg_sleep(60);
  SELECT status_code, content INTO resp FROM net._http_response WHERE id = req_id;
  RAISE NOTICE 'req_id=% status=% body=%', req_id, resp.status_code, LEFT(COALESCE(resp.content,''), 2000);
END $$;