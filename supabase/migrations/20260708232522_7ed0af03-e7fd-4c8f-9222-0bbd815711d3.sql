CREATE OR REPLACE FUNCTION public._trigger_ipaper_push_manual() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid bigint; k text;
BEGIN
  SELECT decrypted_secret INTO k FROM vault.decrypted_secrets WHERE name='email_queue_service_role_key';
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||k),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) INTO rid;
  RETURN rid;
END; $$;
SELECT public._trigger_ipaper_push_manual() AS req_id;