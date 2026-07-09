DO $$
DECLARE
  req_id bigint;
  svc text;
BEGIN
  SELECT decrypted_secret INTO svc FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  IF svc IS NULL THEN
    SELECT decrypted_secret INTO svc FROM vault.decrypted_secrets WHERE name ILIKE '%service_role%' LIMIT 1;
  END IF;
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||svc,
      'apikey', svc
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) INTO req_id;
  RAISE NOTICE 'req_id=% svc_len=%', req_id, length(svc);
END $$;