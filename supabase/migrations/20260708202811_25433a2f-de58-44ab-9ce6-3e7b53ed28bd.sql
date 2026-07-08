DO $$
DECLARE k text;
BEGIN
  SELECT decrypted_secret INTO k FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key' LIMIT 1;
  PERFORM net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||k),
    body := jsonb_build_object('job','sync-estoque-live')
  );
END $$;