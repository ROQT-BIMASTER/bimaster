CREATE OR REPLACE FUNCTION public._set_rrtask_webhook_secret(_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  IF _value IS NULL OR length(_value) < 8 THEN
    RAISE EXCEPTION 'invalid secret';
  END IF;
  BEGIN
    PERFORM vault.create_secret(_value, 'rrtask_webhook_secret',
      'Notion verification_token for RR-Tasks webhook');
  EXCEPTION WHEN unique_violation THEN
    UPDATE vault.secrets SET secret = _value WHERE name = 'rrtask_webhook_secret';
  END;
END $$;
REVOKE ALL ON FUNCTION public._set_rrtask_webhook_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._set_rrtask_webhook_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public._set_rrtask_webhook_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._set_rrtask_webhook_secret(text) TO service_role;