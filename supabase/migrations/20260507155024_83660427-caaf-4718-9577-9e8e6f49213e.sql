
-- Helper para o cron acessar secrets do vault de forma segura
CREATE OR REPLACE FUNCTION public._get_vault_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public._get_vault_secret(text) FROM public, anon, authenticated;
