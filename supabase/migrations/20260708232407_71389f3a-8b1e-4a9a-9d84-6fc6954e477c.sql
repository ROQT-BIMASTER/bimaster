CREATE OR REPLACE FUNCTION public._trigger_ipaper_push_manual() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', public._get_cron_secret()),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) INTO rid;
  RETURN rid;
END; $$;