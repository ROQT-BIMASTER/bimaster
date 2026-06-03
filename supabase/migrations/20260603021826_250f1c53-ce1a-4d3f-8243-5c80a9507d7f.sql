-- 1. Cria/atualiza secret no vault com valor forte aleatório
DO $$
DECLARE v_secret text := encode(gen_random_bytes(48), 'base64');
BEGIN
  BEGIN
    PERFORM vault.create_secret(v_secret, 'rrtask_cron_secret',
      'Shared secret between pg_cron rrtask job and rrtask-poll-status edge function');
  EXCEPTION WHEN unique_violation THEN
    UPDATE vault.secrets
       SET secret = v_secret
     WHERE name = 'rrtask_cron_secret';
  END;
END $$;

-- 2. RPC SECURITY DEFINER restrita a service_role
CREATE OR REPLACE FUNCTION public._get_rrtask_cron_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'rrtask_cron_secret' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._get_rrtask_cron_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._get_rrtask_cron_secret() FROM anon;
REVOKE ALL ON FUNCTION public._get_rrtask_cron_secret() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._get_rrtask_cron_secret() TO service_role;

-- 3. Recria o cron para enviar x-cron-secret em vez de Bearer SR
DO $$
BEGIN
  PERFORM cron.unschedule('rrtask-poll-status-every-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'rrtask-poll-status-every-5min',
  '*/5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/rrtask-poll-status',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public._get_rrtask_cron_secret()
    ),
    body := '{}'::jsonb
  );
  $cron$
);