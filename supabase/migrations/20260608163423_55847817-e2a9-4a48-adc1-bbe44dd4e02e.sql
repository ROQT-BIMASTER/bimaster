-- 1) Habilitar Realtime na tabela briefings para que mudanças no status RR-Tasks
--    propaguem para a UI sem reload.
ALTER TABLE public.briefings REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.briefings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 2) Vault secret para o webhook do Notion (assinatura HMAC).
DO $$
DECLARE v_secret text := encode(gen_random_bytes(48), 'base64');
BEGIN
  BEGIN
    PERFORM vault.create_secret(v_secret, 'rrtask_webhook_secret',
      'Shared secret used to verify Notion webhook deliveries for RR-Tasks');
  EXCEPTION WHEN unique_violation THEN
    -- mantém o valor já configurado (não sobrescreve para não invalidar o que o Notion conhece)
    NULL;
  END;
END $$;

-- 3) RPC SECURITY DEFINER restrita a service_role para ler o secret do webhook.
CREATE OR REPLACE FUNCTION public._get_rrtask_webhook_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'rrtask_webhook_secret' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public._get_rrtask_webhook_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._get_rrtask_webhook_secret() FROM anon;
REVOKE ALL ON FUNCTION public._get_rrtask_webhook_secret() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._get_rrtask_webhook_secret() TO service_role;

-- 4) Permitir a action 'webhook' no log de sincronização RR-Tasks.
ALTER TABLE public.rrtask_sync_log
  DROP CONSTRAINT IF EXISTS rrtask_sync_log_action_check;
ALTER TABLE public.rrtask_sync_log
  ADD CONSTRAINT rrtask_sync_log_action_check
  CHECK (action IN ('create','update','poll','error','webhook'));