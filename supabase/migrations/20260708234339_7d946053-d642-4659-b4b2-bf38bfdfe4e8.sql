SELECT net.http_post(
  url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'Authorization','Bearer '|| (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
) AS request_id;